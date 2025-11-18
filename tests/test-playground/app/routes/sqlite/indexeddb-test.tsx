import type { RoutePath } from "@firtoz/router-toolkit";
import {
	DrizzleIndexedDBProvider,
	useDrizzleIndexedDB,
} from "@firtoz/drizzle-indexeddb";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { todoLoader } from "~/utils/todo-loaders";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { TodoListContainer } from "~/components/shared/TodoListContainer";
import type { BaseTodoCollection } from "~/types/collection";

export const loader = todoLoader;

const TodoList = () => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();

	const todoCollection = useCollection("todoTable") as BaseTodoCollection;

	return (
		<TodoListContainer
			collection={todoCollection}
			title="Tasks"
			description="IndexedDB with Drizzle collections"
		/>
	);
};

export default function IndexedDBTest() {
	return (
		<ClientOnly>
			<DrizzleIndexedDBProvider
				dbName="test-indexeddb.db"
				schema={schema}
				migrations={migrations}
				syncMode="on-demand"
			>
				<TodoList />
			</DrizzleIndexedDBProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/sqlite/indexeddb-test"> =
	"/sqlite/indexeddb-test";
