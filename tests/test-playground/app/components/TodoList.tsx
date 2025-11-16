import {
	useDrizzleContext,
	createPerformanceObserver,
	logPerformanceMetrics,
	makeId,
} from "@firtoz/drizzle-sqlite-wasm";
import { useLiveQuery } from "@tanstack/react-db";
import { useState, useEffect, useRef } from "react";
import * as schema from "test-schema/schema";
import { TodoItem } from "~/components/TodoItem";

export const TodoList = ({
	dbName,
	locale,
}: {
	dbName: string;
	locale: Intl.LocalesArgument;
}) => {
	const renderStartRef = useRef(false);
	const observerRef = useRef<PerformanceObserver | null>(null);

	// Mark TodoList render start and setup performance observer
	if (!renderStartRef.current) {
		console.log(`[PERF] TodoList render start for ${dbName}`);
		renderStartRef.current = true;

		// Setup performance observer (only in browser)
		if (typeof window !== "undefined" && !observerRef.current) {
			observerRef.current = createPerformanceObserver(dbName);
		}
	}

	// Cleanup observer on unmount
	useEffect(() => {
		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, []);

	const { useCollection } = useDrizzleContext<typeof schema>();

	const todoCollection = useCollection("todoTable");

	console.log(`[PERF] Collection ready for ${dbName}`);

	const firstQueryRef = useRef(false);
	const { data: todos } = useLiveQuery((q) => {
		if (!firstQueryRef.current) {
			console.log(`[PERF] First query start for ${dbName}`);
		}
		return q.from({ todo: todoCollection }).orderBy(({ todo }) => {
			return todo.createdAt;
		}, "asc");
	});

	// Track when first query completes
	useEffect(() => {
		if (todos && !firstQueryRef.current) {
			console.log(`[PERF] First query complete for ${dbName}`);

			// Create end-to-end measurement

			console.log(`[PERF] End-to-end initialization complete for ${dbName}`);

			// Log full performance report after a short delay to let all measures complete
			setTimeout(() => {
				logPerformanceMetrics(dbName);
			}, 100);

			firstQueryRef.current = true;
		}
	}, [todos, dbName]);

	const [newTodo, setNewTodo] = useState("");

	const handleAddTodo = () => {
		const trimmedTodo = newTodo.trim();
		if (trimmedTodo) {
			todoCollection.insert({
				id: makeId(schema.todoTable, crypto.randomUUID()),
				title: trimmedTodo,
				completed: false,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
				parentId: null,
				userId: null,
			});
			setNewTodo("");
		}
	};

	const handleToggleComplete = (id: schema.Todo["id"]) => {
		const tx = todoCollection.update(id, (draft) => {
			draft.completed = !draft.completed;
		});

		console.log(`[${new Date().toISOString()}] tx`, tx);

		tx.isPersisted.promise.then(
			(isPersisted) => {
				console.log(
					`[${new Date().toISOString()}] tx isPersisted`,
					isPersisted,
				);
			},
			(error) => {
				console.error(`[${new Date().toISOString()}] tx error`, error);
			},
		);
	};

	const handleDeleteTodo = (id: schema.Todo["id"]) => {
		todoCollection.delete(id);
	};

	return (
		<div>
			<h1>Todos</h1>
			<p>
				Database: <code>{dbName}</code>
			</p>

			{/* Input Section */}
			<div>
				<div>
					<input
						type="text"
						value={newTodo}
						onChange={(e) => setNewTodo(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && newTodo.trim()) {
								handleAddTodo();
							}
						}}
						placeholder="What needs to be done?"
					/>
					<button
						onClick={handleAddTodo}
						disabled={!newTodo.trim()}
						type="button"
					>
						+ Add
					</button>
				</div>
			</div>

			{/* Todos Grid */}
			<div>
				{todos?.map((todo) => (
					<TodoItem
						key={todo.id}
						todo={todo}
						onToggleComplete={handleToggleComplete}
						onDelete={handleDeleteTodo}
						locale={locale}
					/>
				))}
			</div>
		</div>
	);
};
