import { useEffect, useMemo } from "react";
import { SqliteWorkerClient } from "@firtoz/drizzle-sqlite-wasm";
import {
	migrate,
	type DurableSqliteMigrationConfig,
} from "@firtoz/drizzle-sqlite-wasm/sqlite-wasm-migrator";
import { drizzleSqliteWasmWorker } from "@firtoz/drizzle-sqlite-wasm/drizzle-sqlite-wasm-worker";

export const useDrizzle = <TSchema extends Record<string, unknown>>(
	WorkerConstructor: new () => Worker,
	dbName: string,
	schema: TSchema,
	migrations: DurableSqliteMigrationConfig,
) => {
	const sqliteClient = useMemo(
		() => new SqliteWorkerClient(new WorkerConstructor(), dbName),
		[dbName, WorkerConstructor],
	);

	const drizzle = useMemo(() => {
		return drizzleSqliteWasmWorker<TSchema>(sqliteClient, { schema });
	}, [sqliteClient, schema]);

	useEffect(() => {
		sqliteClient.onStarted(async () => {
			await migrate(drizzle, migrations);
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient, drizzle, migrations]);

	return { drizzle };
};
