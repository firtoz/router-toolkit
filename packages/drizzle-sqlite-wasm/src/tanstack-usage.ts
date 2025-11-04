import { createCollection } from "@tanstack/db";

import { text, integer } from "drizzle-orm/sqlite-core";
import { Database } from "@sqlite.org/sqlite-wasm";
import { drizzleSqliteWasm } from "./drizzle-sqlite-wasm";
import {
	drizzleCollectionOptions,
	syncableTable,
} from "./drizzleCollectionOptions";

const todoTable = syncableTable("todos", {
	text: text("text").notNull(),
	completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
});

const drizzle = drizzleSqliteWasm(new Database(":memory:"), {
	schema: {
		todoTable,
	},
});

const sqliteWasmTodos = createCollection(
	drizzleCollectionOptions({ drizzle, tableName: "todoTable" }),
);

sqliteWasmTodos.insert({
	id: "1",
	text: "Buy milk",
	completed: false,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
});

sqliteWasmTodos.update(["1"], (drafts) => {
	drafts[0].text = "Buy milk";
	drafts[0].completed = true;
});

sqliteWasmTodos.delete(["1"]);

const todo = sqliteWasmTodos.get("1");
if (todo) {
	console.log(todo.text);
	console.log(todo.completed);
	console.log(todo.createdAt);
	console.log(todo.updatedAt);
	console.log(todo.deletedAt);
}
