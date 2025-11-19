import type { RoutePath } from "@firtoz/router-toolkit";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
	DrizzleSqliteProvider,
	useDrizzleSqlite,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { todoLoader } from "~/utils/todo-loaders";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { TodoListContainer } from "~/components/shared/TodoListContainer";

export const loader = todoLoader;

const TodoList = () => {
	const { useCollection } = useDrizzleSqlite<typeof schema>();

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
	const [searchParams, setSearchParams] = useSearchParams();
	const [enableCheckpoint, setEnableCheckpoint] = useState(() => {
		const param = searchParams.get("checkpoint");
		return param === null || param === "true";
	});

	const toggleCheckpoint = useCallback(() => {
		const newValue = !enableCheckpoint;
		setEnableCheckpoint(newValue);
		setSearchParams(
			(prev) => {
				prev.set("checkpoint", String(newValue));
				return prev;
			},
			{ replace: true },
		);
	}, [setSearchParams, enableCheckpoint]);

	return (
		<ClientOnly>
			<div style={{ marginBottom: "1rem", padding: "0.5rem" }}>
				<label
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						cursor: "pointer",
					}}
				>
					<input
						type="checkbox"
						checked={enableCheckpoint}
						onChange={toggleCheckpoint}
						data-testid="checkpoint-toggle"
					/>
					<span>
						Enable WAL Checkpoint (ensures OPFS persistence){" "}
						{enableCheckpoint ? "✓" : "✗"}
					</span>
				</label>
			</div>
			<DrizzleSqliteProvider
				worker={SqliteWorker}
				dbName="test.db"
				schema={schema}
				migrations={migrations}
				debug={true}
				enableCheckpoint={enableCheckpoint}
			>
				<TodoList />
			</DrizzleSqliteProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/sqlite-test"> =
	"/collections/sqlite-test";
