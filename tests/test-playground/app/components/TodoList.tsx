import { useDrizzleContext } from "@firtoz/drizzle-sqlite-wasm";
import { useLiveQuery } from "@tanstack/react-db";
import { useState } from "react";
import type * as schema from "test-schema/schema";
import { TodoItem } from "~/components/TodoItem";

export const TodoList = ({ dbName }: { dbName: string }) => {
	const { useCollection } = useDrizzleContext<typeof schema>();

	const todoCollection = useCollection("todoTable");

	const { data: todos } = useLiveQuery((q) =>
		q.from({ todo: todoCollection }).orderBy(({ todo }) => {
			return todo.createdAt;
		}, "asc"),
	);

	const [newTodo, setNewTodo] = useState("");

	const handleAddTodo = () => {
		const trimmedTodo = newTodo.trim();
		if (trimmedTodo) {
			todoCollection.insert({
				id: crypto.randomUUID(),
				title: trimmedTodo,
				completed: false,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			});
			setNewTodo("");
		}
	};

	const handleToggleComplete = (id: string) => {
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

	const handleDeleteTodo = (id: string) => {
		todoCollection.delete(id);
	};

	return (
		<div className="max-w-4xl mx-auto p-6">
			<h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
				Todos
			</h1>
			<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
				Database:{" "}
				<code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
					{dbName}
				</code>
			</p>

			{/* Input Section */}
			<div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 border-gray-200 dark:border-gray-700 p-4">
				<div className="flex gap-3">
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
						className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all"
					/>
					<button
						className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
						onClick={handleAddTodo}
						disabled={!newTodo.trim()}
						type="button"
					>
						+ Add
					</button>
				</div>
			</div>

			{/* Todos Grid */}
			<div className="grid gap-4">
				{todos?.map((todo) => (
					<TodoItem
						key={todo.id}
						todo={todo}
						onToggleComplete={handleToggleComplete}
						onDelete={handleDeleteTodo}
					/>
				))}
			</div>
		</div>
	);
};
