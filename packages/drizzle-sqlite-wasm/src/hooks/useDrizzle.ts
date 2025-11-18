import { useEffect, useMemo, useRef, useState } from "react";
import {
	customSqliteMigrate,
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
	debug?: boolean,
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
			// Initialize manager if not already initialized
			if (!isSqliteWorkerInitialized()) {
				await initializeSqliteWorker(WorkerConstructor);
			}

			// Get manager and create db instance
			const { getSqliteWorkerManager } = await import(
				"../worker/global-manager"
			);
			const manager = getSqliteWorkerManager();
			const instance = await manager.getDbInstance(dbName);

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
		if (debug) {
			console.log(`[DEBUG] ${dbName} - creating drizzle proxy wrapper`);
		}
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
			if (debug) {
				console.log(`[DEBUG] ${dbName} - waiting for sqliteClient...`);
			}
			return;
		}

		sqliteClient.onStarted(async () => {
			try {
				await customSqliteMigrate(drizzle, migrations);
				resolveRef.current?.();
			} catch (error) {
				console.error(`Migration error for ${dbName}:`, error);
				rejectRef.current?.(error);
			}
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient, drizzle, migrations, dbName]);

	return { drizzle, readyPromise };
};
