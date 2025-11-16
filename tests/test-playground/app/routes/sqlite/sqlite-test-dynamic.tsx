import type { RoutePath } from "@firtoz/router-toolkit";
import { DrizzleSqliteProvider } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { data, useLoaderData, useParams } from "react-router";
import { TodoList } from "../../components/TodoList";
import { useEffect, useState } from "react";

import type { Route } from "./+types/sqlite-test-dynamic";

export const loader = async ({ request, params }: Route.LoaderArgs) => {
	const headers = request.headers;
	const locale = headers.get("accept-language")?.split(",")[0] || "en-US";
	return data({ locale });
};

export default function SqliteTestDynamic({ params }: Route.ComponentProps) {
	const { locale } = useLoaderData<typeof loader>();
	const { dbName } = params;

	if (!dbName) {
		return <div>No database name provided</div>;
	}

	// Mark component mount start
	useEffect(() => {
		console.log(`[PERF] Component mount start for ${dbName}`);
	}, [dbName]);

	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<DrizzleSqliteProvider
			key={dbName}
			worker={SqliteWorker}
			dbName={`${dbName}.db`}
			schema={schema}
			migrations={migrations}
		>
			{mounted && <TodoList dbName={dbName} locale={locale} />}
		</DrizzleSqliteProvider>
	);
}

export const route: RoutePath<"/sqlite/sqlite-test/:dbName"> =
	"/sqlite/sqlite-test/:dbName";
