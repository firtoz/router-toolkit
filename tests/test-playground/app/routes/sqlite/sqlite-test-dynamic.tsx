import type { RoutePath } from "@firtoz/router-toolkit";
import { DrizzleProvider } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { useParams } from "react-router";
import { TodoList } from "../../components/TodoList";
import { useEffect, useState } from "react";

export default function SqliteTestDynamic() {
	const { dbName } = useParams<{ dbName: string }>();

	if (!dbName) {
		return <div>No database name provided</div>;
	}

	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<DrizzleProvider
			key={dbName}
			worker={SqliteWorker}
			dbName={`${dbName}.db`}
			schema={schema}
			migrations={migrations}
		>
			{mounted && <TodoList dbName={dbName} />}
		</DrizzleProvider>
	);
}

export const route: RoutePath<"/sqlite/sqlite-test/:dbName"> =
	"/sqlite/sqlite-test/:dbName";
