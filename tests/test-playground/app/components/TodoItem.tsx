import type { Todo } from "test-schema/schema";
import { formatDateWithMs } from "~/utils/date-format";

export interface TodoItemProps {
	todo: Todo;
	onToggleComplete: (id: Todo["id"]) => void;
	onDelete: (id: Todo["id"]) => void;
	locale: Intl.LocalesArgument;
}

export const TodoItem = ({
	todo,
	onToggleComplete,
	onDelete,
	locale,
}: TodoItemProps) => {
	return (
		<div data-testid={`todo-card-${todo.id}`}>
			<div>
				<div>
					<div>
						<div>
							<h3 data-testid={`todo-title-${todo.id}`}>{todo.title}</h3>
							<span data-testid={`todo-status-${todo.id}`}>
								{todo.completed ? "✅ Completed" : "⏳ Pending"}
							</span>
						</div>

						<div>
							<div>
								<span>ID:</span>
								<code data-testid={`todo-id-${todo.id}`}>{todo.id}</code>
							</div>
							<div>
								<span>
									<span>Created:</span>{" "}
									<span data-testid={`todo-created-${todo.id}`}>
										{formatDateWithMs(todo.createdAt, locale)}
									</span>
								</span>
								<span>
									<span>Updated:</span>{" "}
									<span data-testid={`todo-updated-${todo.id}`}>
										{formatDateWithMs(todo.updatedAt, locale)}
									</span>
								</span>
							</div>
						</div>
					</div>

					<div>
						<button
							data-testid={`todo-toggle-${todo.id}`}
							onClick={() => onToggleComplete(todo.id)}
							type="button"
						>
							{todo.completed ? "↩️ Undo" : "✅ Complete"}
						</button>
						<button
							data-testid={`todo-delete-${todo.id}`}
							onClick={() => onDelete(todo.id)}
							type="button"
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
