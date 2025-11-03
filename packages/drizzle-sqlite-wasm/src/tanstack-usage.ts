import {
	BaseCollectionConfig,
	type CollectionConfig,
	createCollection,
	type InferSchemaOutput,
	type UtilsRecord,
} from "@tanstack/db";
import { QueryClient } from "@tanstack/query-core";

import z from "zod/v4";
import { webSocketCollectionOptions } from "./webSocketCollectionOptions";
import {
	type InferSelectSchema,
	sqliteWasmCollectionOptions,
} from "./sqliteWasmCollectionOptions";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { Database } from "@sqlite.org/sqlite-wasm";
import { drizzleSqliteWasm } from "./drizzle-sqlite-wasm";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { drizzleCollectionOptions } from "./drizzleCollectionOptions";

const todoSchema = z.object({
	id: z.string(),
	text: z.string(),
	completed: z.boolean(),
});

type Todo = z.infer<typeof todoSchema>;

// const websocketCollectionOpts = webSocketCollectionOptions({
//     url: "ws://localhost:8080/todos",
//     getKey: (todo) => todo.id,
//     schema: todoSchema,
// };

// const websocketTodos = createCollection(
// 	websocketCollectionOpts,
// 	// queryCollectionOptions({
// 	// 	queryKey: ["todoItems"],
// 	// 	queryFn: async () => {
// 	// 		const response = await fetch("/api/todos");
// 	// 		return response.json();
// 	// 	},
// 	// 	queryClient,
// 	// 	getKey: (item) => item.id,
// 	// 	schema: todoSchema, // any standard schema
// 	// }),
// );

// // Use the collection
// websocketTodos.insert({ id: "1", text: "Buy as", completed: false });

// // Access utilities
// websocketTodos.utils.getConnectionState(); // 'connected'
// websocketTodos.utils.reconnect(); // Force reconnect

const todoTable = sqliteTable("todos", {
	id: text("id").primaryKey(),
	text: text("text"),
	completed: integer("completed", { mode: "boolean" }),
	createdAt: integer("createdAt", { mode: "timestamp" }).default(
		sql`CURRENT_TIMESTAMP`,
	),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).default(
		sql`CURRENT_TIMESTAMP`,
	),
	deletedAt: integer("deletedAt", { mode: "timestamp" }).default(sql`NULL`),
});

const testValue = 5;

const drizzle = drizzleSqliteWasm(new Database(":memory:"), {
	schema: {
		todoTable,
		testValue,
	},
});

type TodoInsert = typeof todoTable.$inferInsert;

type InferTodo = InferSelectSchema<typeof todoTable>;

type InferredTodo = InferSchemaOutput<InferSelectSchema<typeof todoTable>>;

const toInsert: TodoInsert = {
	id: "1",
	text: "Buy milk",
	completed: false,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
};

drizzle.insert(todoTable).values([toInsert]);

const selectSchema = createSelectSchema(todoTable);

type SelectSchema = typeof selectSchema;

const wasmCollectionOptions = {} as unknown as CollectionConfig<
	InferSchemaOutput<SelectSchema>,
	string | number,
	SelectSchema
	// SelectSchema
	// UtilsRecord
> & {
	// utils?: UtilsRecord;
	// schema: z.ZodObject<{
	//     id: z.ZodString;
	//     text: z.ZodString;
	//     completed: z.ZodBoolean;
	// }, z.core.$strip>;
	schema: SelectSchema;
};

// const sqliteWasmTodos = createCollection<
// SelectSchema, string | number, UtilsRecord>(wasmCollectionOptions);
// const sqliteWasmTodos = createCollection(sqliteWasmCollectionOptions({
//     drizzle: drizzle,
//     tableName: 'todoTable',
// }));

const testTable = sqliteTable("todos", {
	id: text("id").primaryKey(),
	text: text("text"),
	completed: integer("completed", { mode: "boolean" }),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	deletedAt: integer("deletedAt", { mode: "timestamp" }).default(sql`NULL`),
});

const sqliteWasmTodos = createCollection(
	drizzleCollectionOptions({ table: testTable }),
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

sqliteWasmTodos.get("1");
