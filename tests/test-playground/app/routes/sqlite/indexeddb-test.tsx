import { fail, success, type RoutePath } from "@firtoz/router-toolkit";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

import {
	DrizzleIndexedDBProvider,
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

const getRelativeTime = (date: Date): string => {
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return "just now";
	if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
	if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
	if (diffInSeconds < 604800)
		return `${Math.floor(diffInSeconds / 86400)}d ago`;
	return date.toLocaleDateString();
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
	}, [todo, onUpdate, editValue]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				e.currentTarget.blur();
			} else if (e.key === "Escape") {
				e.preventDefault();
				flushSync(() => setEditValue(null));
				e.currentTarget.blur();
			}
		},
		[],
	);

	const handleBlur = useCallback(() => {
		if (editValue === null) return;
		handleSave();
		setEditValue(null);
	}, [handleSave, editValue]);

	return (
		<div>
			<input
				type="checkbox"
				checked={selected}
				onChange={(e) => onSelect(todo, e.target.checked)}
				title="Select for bulk actions"
			/>
			<button
				onClick={() => onToggleComplete(todo)}
				disabled={isDeleted}
				type="button"
				aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
			>
				{todo.completed ? "✓" : "○"}
			</button>
			<input
				type="text"
				value={editValue ?? todo.title}
				onChange={(e) => setEditValue(e.target.value)}
				onFocus={() => setEditValue(todo.title)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				disabled={isDeleted || todo.completed}
			/>
			<small title={formatDateWithMs(todo.updatedAt, locale)}>
				Updated {getRelativeTime(todo.updatedAt)}
			</small>
			{todo.createdAt.getTime() !== todo.updatedAt.getTime() && (
				<small title={formatDateWithMs(todo.createdAt, locale)}>
					• Created {getRelativeTime(todo.createdAt)}
				</small>
			)}
			<button onClick={() => onDelete(todo)} type="button">
				{isDeleted ? "Restore" : "Delete"}
			</button>
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
			syncMode="on-demand"
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

		if (alreadyDeleted.length > 0) {
			todoCollection.delete(alreadyDeleted.map((t) => t.id));
		}

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

	const selectedTodos =
		todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
	const selectedCompleted = selectedTodos.filter(
		(t) => t.completed && !t.deletedAt,
	).length;
	const selectedIncomplete = selectedTodos.filter(
		(t) => !t.completed && !t.deletedAt,
	).length;

	return (
		<div>
			<h1>Tasks</h1>
			<p>IndexedDB with Drizzle collections</p>

			<div>
				<div>
					<div>Total</div>
					<div>{totalCount}</div>
				</div>
				<div>
					<div>Pending</div>
					<div>{pendingCount}</div>
				</div>
				<div>
					<div>Done</div>
					<div>{completedCount}</div>
				</div>
			</div>

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
					placeholder="Add a new task..."
				/>
				<button
					onClick={handleAddTodo}
					disabled={!newTodo.trim()}
					type="button"
				>
					Add Task
				</button>
			</div>

			<div>
				<button onClick={() => setShowDeleted(!showDeleted)} type="button">
					{showDeleted ? "Hide Deleted" : "Show Deleted"}
				</button>

				{todos && todos.length > 0 && (
					<>
						<button onClick={handleSelectAll} type="button">
							{selectedIds.size === todos.length
								? "Deselect All"
								: "Select All"}
						</button>

						{selectedIds.size > 0 && (
							<>
								{selectedIncomplete > 0 && (
									<button onClick={handleBulkComplete} type="button">
										Complete ({selectedIncomplete})
									</button>
								)}
								{selectedCompleted > 0 && (
									<button onClick={handleBulkUndoComplete} type="button">
										Reopen ({selectedCompleted})
									</button>
								)}
								<button onClick={handleBulkDelete} type="button">
									Delete ({selectedIds.size})
								</button>
							</>
						)}
					</>
				)}
			</div>

			{todos && todos.length > 0 ? (
				<div>
					<InnerTodoList
						todos={todos}
						selectedIds={selectedIds}
						onSelect={handleSelect}
					/>
				</div>
			) : (
				<div>
					<div>📝</div>
					<p>No tasks yet. Add one above to get started.</p>
				</div>
			)}
		</div>
	);
};

export const route: RoutePath<"/sqlite/indexeddb-test"> =
	"/sqlite/indexeddb-test";
