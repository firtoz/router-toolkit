// const selectSchema = createSelectSchema(todoTable);

import type { CollectionConfig, InferSchemaOutput } from "@tanstack/db";
import { eq, sql, type BuildColumns, type Table } from "drizzle-orm";
import {
	integer,
	type SQLiteColumnBuilderBase,
	sqliteTable,
	text,
	type SQLiteTableWithColumns,
	type TableConfig,
} from "drizzle-orm/sqlite-core";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { type BuildSchema, createSelectSchema } from "drizzle-zod";

export const idColumn = text("id").primaryKey();
export const createdAtColumn = integer("createdAt", { mode: "timestamp" })
	.default(sql`CURRENT_TIMESTAMP`)
	.notNull();
export const updatedAtColumn = integer("updatedAt", { mode: "timestamp" })
	.default(sql`CURRENT_TIMESTAMP`)
	.notNull();
export const deletedAtColumn = integer("deletedAt", {
	mode: "timestamp",
}).default(sql`NULL`);

export const syncableTable = <
	TTableName extends string,
	TColumns extends Record<string, SQLiteColumnBuilderBase> & {
		id?: never;
		createdAt?: never;
		updatedAt?: never;
		deletedAt?: never;
	},
>(
	tableName: TTableName,
	columns: TColumns,
) => {
	return sqliteTable(tableName, {
		id: idColumn,
		createdAt: createdAtColumn,
		updatedAt: updatedAtColumn,
		deletedAt: deletedAtColumn,
		...columns,
	});
};

type TableWithRequiredFields = SQLiteTableWithColumns<
	Pick<TableConfig, "name" | "schema" | "dialect"> & {
		columns: BuildColumns<
			string,
			{
				id: typeof idColumn;
				createdAt: typeof createdAtColumn;
				updatedAt: typeof updatedAtColumn;
				deletedAt: typeof deletedAtColumn;
			},
			"sqlite"
		>;
	}
>;

export type SelectSchema<TTable extends Table> = BuildSchema<
	"select",
	TTable["_"]["columns"],
	undefined,
	undefined
>;

export type InsertSchema<TTable extends Table> = BuildSchema<
	"insert",
	TTable["_"]["columns"],
	undefined,
	undefined
>;

type SchemaOutput<TTable extends TableWithRequiredFields> = InferSchemaOutput<
	SelectSchema<TTable>
>;

// type CollectionSchema<TTable extends TableWithRequiredFields> = z.ZodPipe<InsertSchema<TTable>, SelectSchema<TTable>>;
type CollectionSchema<TTable extends TableWithRequiredFields> =
	SelectSchema<TTable>;

type DrizzleSchema<TDrizzle extends SqliteRemoteDatabase<any>> =
	TDrizzle["_"]["fullSchema"];

interface DrizzleCollectionConfig<
	TDrizzle extends SqliteRemoteDatabase<any>,
	TTableName extends ValidTableNames<DrizzleSchema<TDrizzle>> = never,
> {
	drizzle: TDrizzle;
	tableName: TTableName;
}

export type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[K in keyof TSchema]: TSchema[K] extends TableWithRequiredFields ? K : never;
}[keyof TSchema];

export function drizzleCollectionOptions<
	TDrizzle extends SqliteRemoteDatabase<any>,
	TTableName extends ValidTableNames<DrizzleSchema<TDrizzle>>,
	TTable extends DrizzleSchema<TDrizzle>[TTableName] & TableWithRequiredFields,
>(
	config: DrizzleCollectionConfig<TDrizzle, TTableName>,
): CollectionConfig<
	InferSchemaOutput<SelectSchema<TTable>>,
	string | number,
	CollectionSchema<TTable>
> & {
	schema: CollectionSchema<TTable>;
} {
	const table = config.drizzle._.fullSchema[config.tableName] as TTable;

	return {
		schema: createSelectSchema(table),
		getKey: (item) => {
			return (item as { id: string }).id;
		},
		sync: {
			sync: (params) => {
				const { begin, write, commit, markReady } = params;

				const initialSync = async () => {
					try {
						begin();

						const items = (await config.drizzle
							.select()
							.from(table)) as unknown as InferSchemaOutput<
							SelectSchema<TTable>
						>[];

						for (const item of items) {
							write({
								type: "insert",
								value: item,
							});
						}

						commit();
					} finally {
						markReady();
					}
				};

				initialSync();

				return () => {
					// TODO: Implement
				};
			},
		},
		onInsert: async (params) => {
			console.log("onInsert", params);

			await config.drizzle.transaction(async (tx) => {
				for (const item of params.transaction.mutations) {
					await tx.insert(table).values(item.modified);
				}
			});
		},
		onUpdate: async (params) => {
			console.log("onUpdate", params);

			await config.drizzle.transaction(async (tx) => {
				for (const item of params.transaction.mutations) {
					await tx
						.update(table)
						.set(item.changes)
						.where(eq(table.id, item.key));
				}
			});
		},
		onDelete: async (params) => {
			console.log("onDelete", params);

			await config.drizzle.transaction(async (tx) => {
				for (const item of params.transaction.mutations) {
					await tx.delete(table).where(eq(table.id, item.key));
				}
			});
		},
	};
}
