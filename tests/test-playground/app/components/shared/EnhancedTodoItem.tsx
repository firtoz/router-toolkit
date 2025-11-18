import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { useLoaderData } from "react-router";
import { formatDateWithMs } from "~/utils/date-format";
import type { todoLoader } from "~/utils/todo-loaders";
import type * as schema from "test-schema/schema";

type Todo = typeof schema.todoTable.$inferSelect;

interface EnhancedTodoItemProps {
	todo: Todo;
	onToggleComplete: (todo: Todo) => void;
	onDelete: (todo: Todo) => void;
	onUpdate: (todo: Todo, title: string) => void;
	selected: boolean;
	onSelect: (todo: Todo, selected: boolean) => void;
}

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

export const EnhancedTodoItem = ({
	todo,
	onToggleComplete,
	onDelete,
	onUpdate,
	selected,
	onSelect,
}: EnhancedTodoItemProps) => {
	const data = useLoaderData<typeof todoLoader>();
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
		<div data-testid={`todo-item-${todo.id}`}>
			<input
				type="checkbox"
				checked={selected}
				onChange={(e) => onSelect(todo, e.target.checked)}
				title="Select for bulk actions"
				data-testid={`todo-select-${todo.id}`}
			/>
			<button
				onClick={() => onToggleComplete(todo)}
				disabled={isDeleted}
				type="button"
				aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
				data-testid={`todo-complete-${todo.id}`}
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
				data-testid={`todo-title-${todo.id}`}
			/>
			<small title={formatDateWithMs(todo.updatedAt, locale)}>
				Updated {getRelativeTime(todo.updatedAt)}
			</small>
			{todo.createdAt.getTime() !== todo.updatedAt.getTime() && (
				<small title={formatDateWithMs(todo.createdAt, locale)}>
					• Created {getRelativeTime(todo.createdAt)}
				</small>
			)}
			<button
				onClick={() => onDelete(todo)}
				type="button"
				data-testid={`todo-delete-${todo.id}`}
			>
				{isDeleted ? "Restore" : "Delete"}
			</button>
		</div>
	);
};
