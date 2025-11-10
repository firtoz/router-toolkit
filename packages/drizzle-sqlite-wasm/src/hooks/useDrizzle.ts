import { useEffect, useMemo, useRef, useState } from "react";
import {
	migrate,
	type DurableSqliteMigrationConfig,
} from "@firtoz/drizzle-sqlite-wasm/sqlite-wasm-migrator";
import { drizzleSqliteWasmWorker } from "@firtoz/drizzle-sqlite-wasm/drizzle-sqlite-wasm-worker";
import type { ISqliteWorkerClient } from "../worker/manager";
import {
	initializeSqliteWorker,
	isSqliteWorkerInitialized,
} from "../worker/global-manager";

export const useDrizzle = <TSchema extends Record<string, unknown>>(
	WorkerConstructor: new () => Worker,
	dbName: string,
	schema: TSchema,
	migrations: DurableSqliteMigrationConfig,
) => {
	const resolveRef = useRef<null | (() => void)>(null);
	const rejectRef = useRef<null | ((error: unknown) => void)>(null);
	const [sqliteClient, setSqliteClient] = useState<ISqliteWorkerClient | null>(
		null,
	);
	const sqliteClientRef = useRef<ISqliteWorkerClient | null>(null);

	const readyPromise = useMemo(() => {
		return new Promise<void>((resolve, reject) => {
			resolveRef.current = resolve;
			rejectRef.current = reject;
		});
	}, []);

	// Initialize the global manager and get db instance
	useEffect(() => {
		if (typeof window === "undefined") {
			// SSR stub
			setSqliteClient({
				performRemoteCallback: () => {},
				onStarted: () => {},
				terminate: () => {},
			});
			return;
		}

		let mounted = true;

		const init = async () => {
			performance.mark(`${dbName}-db-instance-request-start`);
			console.log(`[PERF] Requesting db instance for ${dbName}`);

			// Initialize manager if not already initialized
			if (!isSqliteWorkerInitialized()) {
				performance.mark(`${dbName}-lazy-worker-init-start`);
				await initializeSqliteWorker(WorkerConstructor);
				performance.mark(`${dbName}-lazy-worker-init-end`);
				performance.measure(
					`${dbName}-lazy-worker-init`,
					`${dbName}-lazy-worker-init-start`,
					`${dbName}-lazy-worker-init-end`,
				);
			}

			// Get manager and create db instance
			const { getSqliteWorkerManager } = await import(
				"../worker/global-manager"
			);
			const manager = getSqliteWorkerManager();
			const instance = await manager.getDbInstance(dbName);

			performance.mark(`${dbName}-db-instance-ready`);
			performance.measure(
				`${dbName}-db-instance-request`,
				`${dbName}-db-instance-request-start`,
				`${dbName}-db-instance-ready`,
			);
			console.log(`[PERF] DB instance ready for ${dbName}`);

			if (mounted) {
				sqliteClientRef.current = instance;
				setSqliteClient(instance);
			}
		};

		init();

		return () => {
			mounted = false;
		};
	}, [dbName, WorkerConstructor]);

	// Create drizzle instance with a callback-based approach that waits for the client
	const drizzle = useMemo(() => {
		console.log(`[DEBUG] ${dbName} - creating drizzle proxy wrapper`);
		return drizzleSqliteWasmWorker<TSchema>(
			{
				performRemoteCallback: (data, resolve, reject) => {
					const client = sqliteClientRef.current;
					if (!client) {
						console.error(
							`[DEBUG] ${dbName} - performRemoteCallback called but no sqliteClient yet`,
						);
						reject(
							new Error(
								`Database ${dbName} not ready yet - still initializing`,
							),
						);
						return;
					}
					console.log(
						`[DEBUG] ${dbName} - forwarding performRemoteCallback to real client`,
					);
					client.performRemoteCallback(data, resolve, reject);
				},
				onStarted: (callback) => {
					const client = sqliteClientRef.current;
					if (!client) {
						console.warn(
							`[DEBUG] ${dbName} - onStarted called but no sqliteClient yet`,
						);
						return;
					}
					client.onStarted(callback);
				},
				terminate: () => {
					sqliteClientRef.current?.terminate();
				},
			},
			{ schema },
		);
	}, [schema, dbName]); // Using ref for sqliteClient to avoid recreating drizzle

	useEffect(() => {
		if (!sqliteClient) {
			console.log(`[DEBUG] ${dbName} - waiting for sqliteClient...`);
			return;
		}

		console.log(`[DEBUG] ${dbName} - sqliteClient ready, setting up migration`);
		sqliteClient.onStarted(async () => {
			try {
				performance.mark(`${dbName}-migration-start`);
				console.log(`[PERF] Migration start for ${dbName}`);
				await migrate(drizzle, migrations);
				performance.mark(`${dbName}-migration-end`);
				performance.measure(
					`${dbName}-migration`,
					`${dbName}-migration-start`,
					`${dbName}-migration-end`,
				);
				console.log(`[PERF] Migration complete for ${dbName}`);
				resolveRef.current?.();
			} catch (error) {
				console.error(`[PERF] Migration error for ${dbName}:`, error);
				rejectRef.current?.(error);
			}
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient, drizzle, migrations, dbName]);

	return { drizzle, readyPromise };
};
