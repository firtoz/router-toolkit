import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const todoTable = sqliteTable("todo", {
	id: integer("id").primaryKey(),
	title: text("title").notNull(),
	completed: integer("completed").notNull().default(0),
	createdAt: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Todo = typeof todoTable.$inferSelect;
export type InsertTodo = typeof todoTable.$inferInsert;
