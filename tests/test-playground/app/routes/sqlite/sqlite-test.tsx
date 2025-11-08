import type { RoutePath } from "@firtoz/router-toolkit";
import { useCallback, useEffect, useState } from "react";
import {
	DrizzleProvider,
	useDrizzleContext,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { useLiveQuery } from "@tanstack/react-db";
import { formatDateWithMs } from "~/utils/date-format";

type Todo = typeof schema.todoTable.$inferSelect;

interface TodoItemProps {
	todo: Todo;
	onToggleComplete: (id: string) => void;
	onDelete: (id: string) => void;
}

const TodoItem = ({ todo, onToggleComplete, onDelete }: TodoItemProps) => {
	return (
		<div
			className={`rounded-lg shadow-md border-2 transition-all hover:shadow-lg ${
				todo.completed
					? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
					: "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
			}`}
		>
			<div className="p-5">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3 mb-2">
							<h3
								className={`text-xl font-semibold ${
									todo.completed
										? "text-gray-500 dark:text-gray-400 line-through"
										: "text-gray-900 dark:text-gray-100"
								}`}
							>
								{todo.title}
							</h3>
							<span
								className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
									todo.completed
										? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
										: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300"
								}`}
							>
								{todo.completed ? "✅ Completed" : "⏳ Pending"}
							</span>
						</div>

						<div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
							<div className="flex items-center gap-2">
								<span className="font-medium">ID:</span>
								<code className="text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300 px-2 py-0.5 rounded">
									{todo.id}
								</code>
							</div>
							<div className="flex items-center gap-4 flex-wrap">
								<span>
									<span className="font-medium">Created:</span>{" "}
									{formatDateWithMs(todo.createdAt)}
								</span>
								<span>
									<span className="font-medium">Updated:</span>{" "}
									{formatDateWithMs(todo.updatedAt)}
								</span>
							</div>
						</div>
					</div>

					<div className="flex gap-2">
						<button
							onClick={() => onToggleComplete(todo.id)}
							type="button"
							className={`px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow-md active:scale-95 ${
								todo.completed
									? "bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white"
									: "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white"
							}`}
						>
							{todo.completed ? "↩️ Undo" : "✅ Complete"}
						</button>
						<button
							onClick={() => onDelete(todo.id)}
							type="button"
							className="px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow-md active:scale-95 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white"
							title="Delete todo"
						>
							🗑️
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const TodoList = () => {
	const { useCollection } = useDrizzleContext<typeof schema>();

	const todoCollection = useCollection("todoTable");

	const { data: todos } = useLiveQuery((q) =>
		q
			.from({ todo: todoCollection })
			.orderBy(({ todo }) => todo.createdAt, "asc"),
	);

	const [newTodo, setNewTodo] = useState("");

	const handleAddTodo = useCallback(() => {
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
	}, [newTodo, todoCollection]);

	const handleToggleComplete = useCallback(
		(id: string) => {
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
		},
		[todoCollection],
	);

	const handleDeleteTodo = useCallback(
		(id: string) => {
			todoCollection.delete(id);
		},
		[todoCollection],
	);

	return (
		<div className="max-w-4xl mx-auto p-6">
			<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
				Todos
			</h1>

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

export default function SqliteTest() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div>Loading...</div>;
	}

	return (
		<DrizzleProvider
			worker={SqliteWorker}
			dbName="test.db"
			schema={schema}
			migrations={migrations}
		>
			<TodoList />
		</DrizzleProvider>
	);
}

export const route: RoutePath<"/sqlite/sqlite-test"> = "/sqlite/sqlite-test";
