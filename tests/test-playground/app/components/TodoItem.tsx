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
		<div>
			<div>
				<div>
					<div>
						<div>
							<h3>{todo.title}</h3>
							<span>{todo.completed ? "✅ Completed" : "⏳ Pending"}</span>
						</div>

						<div>
							<div>
								<span>ID:</span>
								<code>{todo.id}</code>
							</div>
							<div>
								<span>
									<span>Created:</span>{" "}
									{formatDateWithMs(todo.createdAt, locale)}
								</span>
								<span>
									<span>Updated:</span>{" "}
									{formatDateWithMs(todo.updatedAt, locale)}
								</span>
							</div>
						</div>
					</div>

					<div>
						<button onClick={() => onToggleComplete(todo.id)} type="button">
							{todo.completed ? "↩️ Undo" : "✅ Complete"}
						</button>
						<button
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
