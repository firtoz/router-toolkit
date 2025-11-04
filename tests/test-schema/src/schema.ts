import { syncableTable } from "@firtoz/drizzle-sqlite-wasm";
import { integer, text } from "drizzle-orm/sqlite-core";

export const todoTable = syncableTable("todo", {
	title: text("title").notNull(),
	completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

export type Todo = typeof todoTable.$inferSelect;
export type InsertTodo = typeof todoTable.$inferInsert;
