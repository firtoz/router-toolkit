import { useEffect, useMemo, useRef } from "react";
import { SqliteWorkerClient } from "@firtoz/drizzle-sqlite-wasm";
import {
	migrate,
	type DurableSqliteMigrationConfig,
} from "@firtoz/drizzle-sqlite-wasm/sqlite-wasm-migrator";
import { drizzleSqliteWasmWorker } from "@firtoz/drizzle-sqlite-wasm/drizzle-sqlite-wasm-worker";
import type { ISqliteWorkerClient } from "../worker/client";

export const useDrizzle = <TSchema extends Record<string, unknown>>(
	WorkerConstructor: new () => Worker,
	dbName: string,
	schema: TSchema,
	migrations: DurableSqliteMigrationConfig,
) => {
	const resolveRef = useRef<null | (() => void)>(null);
	const rejectRef = useRef<null | ((error: unknown) => void)>(null);

	const readyPromise = useMemo(() => {
		return new Promise<void>((resolve, reject) => {
			resolveRef.current = resolve;
			rejectRef.current = reject;
		});
	}, []);

	const sqliteClient = useMemo((): ISqliteWorkerClient => {
		if (typeof window === "undefined") {
			return {
				performRemoteCallback: () => {},
				onStarted: () => {},
				terminate: () => {},
			} satisfies ISqliteWorkerClient;
		}
		return new SqliteWorkerClient(new WorkerConstructor(), dbName);
	}, [dbName, WorkerConstructor]);

	const drizzle = useMemo(() => {
		return drizzleSqliteWasmWorker<TSchema>(sqliteClient, { schema });
	}, [sqliteClient, schema]);

	useEffect(() => {
		if (!sqliteClient || !drizzle) {
			return;
		}
		sqliteClient.onStarted(async () => {
			try {
				await migrate(drizzle, migrations);
				resolveRef.current?.();
			} catch (error) {
				rejectRef.current?.(error);
			}
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient, drizzle, migrations]);

	return { drizzle, readyPromise };
};
