import type { Todo } from "test-schema/schema";
import { formatDateWithMs } from "~/utils/date-format";

export interface TodoItemProps {
	todo: Todo;
	onToggleComplete: (id: Todo["id"]) => void;
	onDelete: (id: Todo["id"]) => void;
}

export const TodoItem = ({
	todo,
	onToggleComplete,
	onDelete,
}: TodoItemProps) => {
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
