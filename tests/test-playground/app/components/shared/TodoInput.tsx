import { useState, useCallback } from "react";

interface TodoInputProps {
	onAdd: (title: string) => void;
}

export const TodoInput = ({ onAdd }: TodoInputProps) => {
	const [value, setValue] = useState("");

	const handleAdd = useCallback(() => {
		const trimmed = value.trim();
		if (trimmed) {
			onAdd(trimmed);
			setValue("");
		}
	}, [value, onAdd]);

	return (
		<div>
			<input
				type="text"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && value.trim()) {
						handleAdd();
					}
				}}
				placeholder="Add a new task..."
				data-testid="todo-input"
			/>
			<button
				onClick={handleAdd}
				disabled={!value.trim()}
				type="button"
				data-testid="add-task-button"
			>
				Add Task
			</button>
		</div>
	);
};
