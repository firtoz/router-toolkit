import { fail, success, type RoutePath } from "@firtoz/router-toolkit";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
	DrizzleIndexedDBProvider,
	migrateIndexedDBWithFunctions,
	useDrizzleIndexedDB,
} from "@firtoz/drizzle-indexeddb";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { isNull, useLiveQuery } from "@tanstack/react-db";
import { formatDateWithMs } from "~/utils/date-format";
import type { Route } from "./+types/indexeddb-test";
import { data, useLoaderData } from "react-router";

type Todo = typeof schema.todoTable.$inferSelect;

interface TodoItemProps {
	todo: Todo;
	onToggleComplete: (todo: Todo) => void;
	onDelete: (todo: Todo) => void;
	onUpdate: (todo: Todo, title: string) => void;
	selected: boolean;
	onSelect: (todo: Todo, selected: boolean) => void;
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	const headers = new Headers(request.headers);
	const locale = headers.get("accept-language")?.split(",")[0];

	if (!locale) {
		return data(fail("No locale found"), { status: 400 });
	}

	return success({
		locale,
		todos: [] satisfies Todo[],
	});
};

const TodoItem = ({
	todo,
	onToggleComplete,
	onDelete,
	onUpdate,
	selected,
	onSelect,
}: TodoItemProps) => {
	const data = useLoaderData<typeof loader>();
	let locale = "en-US";
	if (data.success) {
		locale = data.result.locale;
	}

	const isDeleted = todo.deletedAt !== null;
	const [editValue, setEditValue] = useState<string | null>(null);

	const handleSave = useCallback(() => {
		if (editValue === null) return;
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== todo.title) {
			onUpdate(todo, trimmed);
		}
	}, [todo.title, todo, onUpdate, editValue]);

	const handleCancel = useCallback(() => {
		setEditValue(null);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				e.currentTarget.blur();
			} else if (e.key === "Escape") {
				e.preventDefault();

				flushSync(() => {
					handleCancel();
				});

				e.currentTarget.blur();
			}
		},
		[handleSave, handleCancel],
	);

	const handleBlur = useCallback(() => {
		if (editValue === null) return;
		handleSave();
		setEditValue(null);
	}, [handleSave, editValue]);

	const handleFocus = useCallback(() => {
		console.log("focus");
		setEditValue(todo.title);
	}, [todo.title]);

	return (
		<div
			className={`group relative rounded border ${
				selected
					? "border-gray-400 dark:border-gray-600 ring-1 ring-gray-300 dark:ring-gray-700"
					: todo.completed
						? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
						: "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
			} ${isDeleted ? "opacity-50" : ""}`}
		>
			<div className="p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3 mb-2">
							<input
								type="checkbox"
								checked={selected}
								onChange={(e) => onSelect(todo, e.target.checked)}
								className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 text-gray-600 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400 cursor-pointer"
							/>
							<div
								className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
									todo.completed
										? "border-gray-400 dark:border-gray-500 bg-gray-400 dark:bg-gray-500"
										: "border-gray-300 dark:border-gray-600 bg-transparent"
								}`}
							>
								{todo.completed && (
									<svg
										className="w-2.5 h-2.5 text-white"
										fill="none"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2.5"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-label="Completed"
									>
										<title>Completed</title>
										<path d="M5 13l4 4L19 7" />
									</svg>
								)}
							</div>
							<input
								type="text"
								value={editValue ?? todo.title}
								onChange={(e) => setEditValue(e.target.value)}
								onFocus={handleFocus}
								onBlur={handleBlur}
								onKeyDown={handleKeyDown}
								disabled={isDeleted || todo.completed}
								className={`flex-1 min-w-0 text-base font-medium border rounded ${
									isDeleted || todo.completed
										? "px-2 py-1 border-transparent bg-transparent text-gray-400 dark:text-gray-500 line-through"
										: "px-2 py-1 border-transparent bg-transparent text-gray-900 dark:text-gray-100 cursor-text hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400"
								}`}
							/>
						</div>

						<div className="ml-7 text-xs text-gray-500 dark:text-gray-400 space-y-1">
							<div className="flex items-center gap-4 flex-wrap">
								<span className="flex items-center gap-1">
									<span>Created:</span>
									<span className="font-mono">
										{formatDateWithMs(todo.createdAt, locale)}
									</span>
								</span>
								<span className="flex items-center gap-1">
									<span>Updated:</span>
									<span className="font-mono">
										{formatDateWithMs(todo.updatedAt, locale)}
									</span>
								</span>
							</div>
						</div>
					</div>

					<div className="flex gap-2 shrink-0">
						<button
							onClick={() => onToggleComplete(todo)}
							type="button"
							disabled={todo.deletedAt !== null}
							className={`px-3 py-1.5 rounded text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed ${
								todo.completed
									? "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
									: "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
							}`}
						>
							{todo.completed ? "Reopen" : "Complete"}
						</button>
						<button
							onClick={() => onDelete(todo)}
							type="button"
							className={`px-3 py-1.5 rounded text-sm font-medium border ${
								isDeleted
									? "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
									: "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
							}`}
							title={isDeleted ? "Restore todo" : "Delete todo"}
							aria-label={isDeleted ? "Restore todo" : "Delete todo"}
						>
							{isDeleted ? (
								<svg
									className="w-4 h-4"
									fill="none"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path d="M3 10a7 7 0 0114 0M3 10l6 6m-6-6l6-6" />
								</svg>
							) : (
								<svg
									className="w-4 h-4"
									fill="none"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const InnerTodoList = ({
	todos,
	selectedIds,
	onSelect,
}: {
	todos: Todo[];
	selectedIds: Set<string>;
	onSelect: (todo: Todo, selected: boolean) => void;
}) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();

	const todoCollection = useCollection("todoTable");

	const handleToggleComplete = useCallback(
		(todo: Todo) => {
			if (todo.deletedAt) {
				return;
			}

			const id = todo.id;

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
		(todo: Todo) => {
			if (todo.deletedAt) {
				todoCollection.delete(todo.id);
				return;
			}

			todoCollection.update(todo.id, (draft) => {
				draft.deletedAt = new Date();
			});
		},
		[todoCollection],
	);

	const handleUpdateTodo = useCallback(
		(todo: Todo, title: string) => {
			todoCollection.update(todo.id, (draft) => {
				draft.title = title;
			});
		},
		[todoCollection],
	);

	return (
		<>
			{todos?.map((todo) => (
				<TodoItem
					key={String(todo.id)}
					todo={todo}
					onToggleComplete={handleToggleComplete}
					onDelete={handleDeleteTodo}
					onUpdate={handleUpdateTodo}
					selected={selectedIds.has(String(todo.id))}
					onSelect={onSelect}
				/>
			))}
		</>
	);
};

export default function IndexedDBTest() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	return (
		<DrizzleIndexedDBProvider
			dbName="test-indexeddb.db"
			schema={schema}
			migrations={migrations}
			migrateFunction={migrateIndexedDBWithFunctions}
			debug={true}
		>
			<TodoList />
		</DrizzleIndexedDBProvider>
	);
}

const TodoList = () => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();

	const todoCollection = useCollection("todoTable");
	const [showDeleted, setShowDeleted] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const { data: todos, isLoading } = useLiveQuery(
		(q) => {
			let query = q.from({
				todo: todoCollection,
			});

			if (!showDeleted) {
				query = query.where(({ todo }) => {
					return isNull(todo.deletedAt);
				});
			}

			return query.orderBy(({ todo }) => {
				return todo.createdAt;
			}, "asc");
		},
		[todoCollection, showDeleted],
	);

	const [newTodo, setNewTodo] = useState("");

	const handleAddTodo = useCallback(() => {
		const trimmedTodo = newTodo.trim();
		if (trimmedTodo) {
			todoCollection.insert({
				title: trimmedTodo,
			});

			setNewTodo("");
		}
	}, [newTodo, todoCollection]);

	const handleSelect = useCallback((todo: Todo, selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			const id = String(todo.id);
			if (selected) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}, []);

	const handleSelectAll = useCallback(() => {
		if (selectedIds.size === todos?.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(todos?.map((t) => String(t.id)) ?? []));
		}
	}, [selectedIds.size, todos]);

	const handleBulkComplete = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const idsToComplete = selectedTodos
			.filter((t) => !t.deletedAt && !t.completed)
			.map((t) => t.id);

		if (idsToComplete.length > 0) {
			todoCollection.update(idsToComplete, (drafts) => {
				for (const draft of drafts) {
					draft.completed = true;
				}
			});
		}
	}, [todos, selectedIds, todoCollection]);

	const handleBulkUndoComplete = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const idsToUndo = selectedTodos
			.filter((t) => !t.deletedAt && t.completed)
			.map((t) => t.id);

		if (idsToUndo.length > 0) {
			todoCollection.update(idsToUndo, (drafts) => {
				for (const draft of drafts) {
					draft.completed = false;
				}
			});
		}
	}, [todos, selectedIds, todoCollection]);

	const handleBulkDelete = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const alreadyDeleted = selectedTodos.filter((t) => t.deletedAt);
		const toSoftDelete = selectedTodos.filter((t) => !t.deletedAt);

		// Permanently delete items that are already soft-deleted
		if (alreadyDeleted.length > 0) {
			todoCollection.delete(alreadyDeleted.map((t) => t.id));
		}

		// Soft delete items that aren't deleted yet
		if (toSoftDelete.length > 0) {
			todoCollection.update(
				toSoftDelete.map((t) => t.id),
				(drafts) => {
					for (const draft of drafts) {
						draft.deletedAt = new Date();
					}
				},
			);
		}
	}, [todos, selectedIds, todoCollection]);

	if (isLoading) {
		return null;
	}

	const completedCount = todos?.filter((t) => t.completed).length ?? 0;
	const totalCount = todos?.length ?? 0;
	const pendingCount = totalCount - completedCount;

	return (
		<div className="min-h-screen bg-white dark:bg-gray-950">
			<div className="max-w-4xl mx-auto px-6 py-6">
				{/* Header */}
				<div className="mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
					<h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
						Tasks
					</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
						IndexedDB with Drizzle collections
					</p>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
							Total
						</p>
						<p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
							{totalCount}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
							Pending
						</p>
						<p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
							{pendingCount}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
							Completed
						</p>
						<p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
							{completedCount}
						</p>
					</div>
				</div>

				{/* Input Section */}
				<div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-800">
					<div className="flex gap-2">
						<input
							type="text"
							value={newTodo}
							onChange={(e) => setNewTodo(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && newTodo.trim()) {
									handleAddTodo();
								}
							}}
							placeholder="Add a new task..."
							className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400 focus:border-gray-500 dark:focus:border-gray-400"
						/>
						<button
							className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							onClick={handleAddTodo}
							disabled={!newTodo.trim()}
							type="button"
						>
							Add
						</button>
					</div>
				</div>

				{/* Filter and Bulk Actions */}
				<div className="mb-4 flex flex-wrap items-center gap-2 pb-4 border-b border-gray-200 dark:border-gray-800">
					<button
						className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium cursor-pointer"
						onClick={() => setShowDeleted(!showDeleted)}
						type="button"
					>
						{showDeleted ? "Hide Deleted" : "Show Deleted"}
					</button>

					{todos && todos.length > 0 && (
						<>
							<button
								className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium cursor-pointer"
								onClick={handleSelectAll}
								type="button"
							>
								{selectedIds.size === todos.length
									? "Deselect All"
									: "Select All"}
							</button>

							{selectedIds.size > 0 &&
								(() => {
									const selectedTodos =
										todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
									const completedCount = selectedTodos.filter(
										(t) => t.completed && !t.deletedAt,
									).length;
									const incompleteCount = selectedTodos.filter(
										(t) => !t.completed && !t.deletedAt,
									).length;

									return (
										<>
											{incompleteCount > 0 && (
												<button
													className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium cursor-pointer"
													onClick={handleBulkComplete}
													type="button"
												>
													Complete ({incompleteCount})
												</button>
											)}
											{completedCount > 0 && (
												<button
													className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium cursor-pointer"
													onClick={handleBulkUndoComplete}
													type="button"
												>
													Reopen ({completedCount})
												</button>
											)}
											<button
												className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium cursor-pointer"
												onClick={handleBulkDelete}
												type="button"
											>
												Delete ({selectedIds.size})
											</button>
										</>
									);
								})()}
						</>
					)}
				</div>

				{/* Todos List */}
				{todos && todos.length > 0 ? (
					<div className="grid gap-4">
						<InnerTodoList
							todos={todos}
							selectedIds={selectedIds}
							onSelect={handleSelect}
						/>
					</div>
				) : (
					<div className="py-12 text-center border border-gray-200 dark:border-gray-800 rounded">
						<p className="text-sm text-gray-500 dark:text-gray-400">
							No tasks yet. Add one above to get started.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export const route: RoutePath<"/sqlite/indexeddb-test"> =
	"/sqlite/indexeddb-test";
