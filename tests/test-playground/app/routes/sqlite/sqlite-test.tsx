import type { RoutePath } from "@firtoz/router-toolkit";
import { useEffect, useMemo, useState } from "react";
import { SqliteWorkerClient } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "../../workers/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { migrate } from "@firtoz/drizzle-sqlite-wasm/sqlite-wasm-migrator";
import { drizzleSqliteWasmWorker } from "@firtoz/drizzle-sqlite-wasm/drizzle-sqlite-wasm-worker";

const SqliteClientWrapper = ({ dbName }: { dbName: string }) => {
	const sqliteClient = useMemo(
		() => new SqliteWorkerClient(new SqliteWorker(), dbName),
		[],
	);

	useEffect(() => {
		sqliteClient.onStarted(async () => {
			console.log(
				`[${new Date().toISOString()}] [SqliteClientWrapper] started`,
			);

			const drizzle = drizzleSqliteWasmWorker(sqliteClient, { schema });
			await migrate(drizzle, migrations, true);

			let todos = await drizzle.query.todoTable.findMany();
			console.log(
				`[${new Date().toISOString()}] [SqliteClientWrapper] todos`,
				todos,
			);

			if (todos.length === 0) {
				console.log(
					`[${new Date().toISOString()}] [SqliteClientWrapper] no todos found, inserting one`,
				);
				await drizzle
					.insert(schema.todoTable)
					.values({
						title: "Buy groceries",
					})
					.execute();

				console.log(
					`[${new Date().toISOString()}] [SqliteClientWrapper] todo inserted`,
				);
			}

			todos = await drizzle.query.todoTable.findMany();
			console.log(
				`[${new Date().toISOString()}] [SqliteClientWrapper] todos`,
				todos,
			);
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient]);

	return null;
};

export default function SqliteTest() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div>Loading...</div>;
	}

	return <SqliteClientWrapper dbName="test.db" />;
}

export const route: RoutePath<"/sqlite/sqlite-test"> = "/sqlite/sqlite-test";
