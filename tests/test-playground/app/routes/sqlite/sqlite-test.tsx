import type { RoutePath } from "@firtoz/router-toolkit";
import { useEffect } from "react";
import {
	DrizzleSqliteProvider,
	useDrizzleContext,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { todoLoader } from "~/utils/todo-loaders";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { TodoListContainer } from "~/components/shared/TodoListContainer";

export const loader = todoLoader;

const TodoList = () => {
	const { useCollection } = useDrizzleContext<typeof schema>();

	const todoCollection = useCollection("todoTable");

	// Expose collection to window for testing
	useEffect(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper
		(window as any).__todoCollection = todoCollection;
		return () => {
			// biome-ignore lint/suspicious/noExplicitAny: Test helper
			delete (window as any).__todoCollection;
		};
	}, [todoCollection]);

	return (
		<TodoListContainer
			collection={todoCollection}
			title="Todos"
			description="SQLite WASM with Drizzle collections"
		/>
	);
};

export default function SqliteTest() {
	return (
		<ClientOnly>
			<DrizzleSqliteProvider
				worker={SqliteWorker}
				dbName="test.db"
				schema={schema}
				migrations={migrations}
				debug={true}
			>
				<TodoList />
			</DrizzleSqliteProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/sqlite/sqlite-test"> = "/sqlite/sqlite-test";
