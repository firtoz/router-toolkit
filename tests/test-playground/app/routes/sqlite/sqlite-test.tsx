import { fail, success, type RoutePath } from "@firtoz/router-toolkit";
import { useCallback, useEffect, useState } from "react";
import {
 DrizzleSqliteProvider,
 useDrizzleContext,
 makeId,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import { useLiveQuery } from "@tanstack/react-db";
import { formatDateWithMs } from "~/utils/date-format";
import type { Route } from "./+types/sqlite-test";
import { data, useLoaderData } from "react-router";

type Todo = typeof schema.todoTable.$inferSelect;

interface TodoItemProps {
 todo: Todo;
 onToggleComplete: (id: Todo["id"]) => void;
 onDelete: (id: Todo["id"]) => void;
}

export const loader = async ({ request }: Route.LoaderArgs) => {
 const headers = new Headers(request.headers);
 const locale = headers.get("accept-language")?.split(",")[0];

 if (!locale) {
 return data(fail("No locale found"), { status: 400 });
 }

 return success({ locale });
};

const TodoItem = ({ todo, onToggleComplete, onDelete }: TodoItemProps) => {
 const data = useLoaderData<typeof loader>();
 let locale = "en-US";
 if (data.success) {
 locale = data.result.locale;
 }
	return (
		<div >
 <div >
 <div >
 <div >
 <div >
						<h3 >
 {todo.title}
 </h3>
						<span >
 {todo.completed ? "✅ Completed" : "⏳ Pending"}
 </span>
 </div>

 <div >
 <div >
 <span >ID:</span>
 <code >
 {todo.id}
 </code>
 </div>
 <div >
 <span>
 <span >Created:</span>{" "}
 {formatDateWithMs(todo.createdAt, locale)}
 </span>
 <span>
 <span >Updated:</span>{" "}
 {formatDateWithMs(todo.updatedAt, locale)}
 </span>
 </div>
 </div>
 </div>

 <div >
					<button
						onClick={() => onToggleComplete(todo.id)}
						type="button"
					>
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
 }, [newTodo, todoCollection]);

 const handleToggleComplete = useCallback(
 (id: Todo["id"]) => {
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
 (id: Todo["id"]) => {
 todoCollection.delete(id);
 },
 [todoCollection],
 );

 return (
 <div >
 <h1 >
 Todos
 </h1>

 {/* Input Section */}
 <div >
 <div >
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
 <div >
 {todos?.map((todo) => (
 <TodoItem
 key={String(todo.id)}
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
 return null;
 }

 return (
 <DrizzleSqliteProvider
 worker={SqliteWorker}
 dbName="test.db"
 schema={schema}
 migrations={migrations}
 >
 <TodoList />
 </DrizzleSqliteProvider>
 );
}

export const route: RoutePath<"/sqlite/sqlite-test"> = "/sqlite/sqlite-test";
