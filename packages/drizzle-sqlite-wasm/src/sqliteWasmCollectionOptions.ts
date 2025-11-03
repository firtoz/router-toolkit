import type { Database } from "@sqlite.org/sqlite-wasm";
import type {
	BaseCollectionConfig,
	CollectionConfig,
	InferSchemaOutput,
	UtilsRecord,
} from "@tanstack/db";
import { type Column, eq, inArray, type Table, type View } from "drizzle-orm";
import type { PgEnum } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import type {
	SQLiteInsertValue,
	SQLiteTableWithColumns,
	SQLiteUpdateSetSource,
	TableConfig,
} from "drizzle-orm/sqlite-core";

interface SqliteWasmUtils extends UtilsRecord {}

interface SqliteWasmCollectionConfig<
	TSchema extends Record<string, unknown>,
	TTableName extends ValidTableNames<TSchema>,
> extends Omit<
		CollectionConfig<
			InferSchemaOutput<InferSelectSchema<TSchema[TTableName]>>,
			string | number,
			InferSelectSchema<TSchema[TTableName]>
		>,
		"onInsert" | "onUpdate" | "onDelete" | "sync" | "schema" | "getKey"
	> {
	tableName: TTableName;
	drizzle: SqliteRemoteDatabase<TSchema>;
}

// Infer the Zod schema type for a given table/view/enum
// Based on what createSelectSchema returns for each type
export type InferSelectSchema<T> = T extends Table | View
	? z.ZodObject<
			{
				[K in keyof T["$inferSelect"]]: z.ZodType<T["$inferSelect"][K]>;
			},
			z.core.$strip
		>
	: z.ZodObject<{}, z.core.$strip>;

export type InferSelect<T extends object> = T extends Table | View
	? T["$inferSelect"]
	: T extends PgEnum<infer TValues>
		? TValues
		: T;

type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[TKey in keyof TSchema]: TSchema[TKey] extends Table | View
		? InferSelect<TSchema[TKey]> extends {
				id: string;
				createdAt: Date | null;
				updatedAt: Date | null;
				deletedAt: Date | null;
			}
			? TKey
			: never
		: never;
}[keyof TSchema];

type ValidSchemaItem<
	TSchema extends Record<string, unknown>,
	TTableName extends ValidTableNames<TSchema>,
> = TSchema[TTableName] &
	Table &
	SQLiteTableWithColumns<
		TableConfig & {
			columns: {
				id: Column & {
					dataType: "string";
				};
				createdAt: Column & {
					dataType: "SQLiteTimestamp";
				};
				updatedAt: Column & {
					dataType: "SQLiteTimestamp";
				};
				deletedAt: Column & {
					dataType: "SQLiteTimestamp";
				};
			};
		}
	>;

export function sqliteWasmCollectionOptions<
	const TSchema extends Record<string, unknown>,
	const TTableName extends ValidTableNames<TSchema>,
>(
	config: SqliteWasmCollectionConfig<TSchema, TTableName>,
): CollectionConfig<
	InferSchemaOutput<typeof zodSchema>,
	string | number,
	typeof zodSchema
> & {
	// utils: SqliteWasmUtils;
	schema: typeof zodSchema;
} {
	const drizzle = config.drizzle;
	const table = drizzle._.fullSchema[config.tableName] as TSchema[TTableName] &
		// Table &
		SQLiteTableWithColumns<
			TableConfig & {
				columns: {
					id: Column & {
						dataType: "string";
					};
					createdAt: Column & {
						dataType: "SQLiteTimestamp";
					};
					updatedAt: Column & {
						dataType: "SQLiteTimestamp";
					};
					deletedAt: Column & {
						dataType: "SQLiteTimestamp";
					};
				};
			}
		>;

	const zodSchema = createSelectSchema(table);

	// type SqliteWasmCollectionOptionResult = CollectionConfig<
	// 	TItem,
	// 	string | number,
	// 	InferSelectSchema<typeof table>
	// >;

	return {
		// ...config,
		id: config.id,
		utils: {},
		schema: zodSchema,
		getKey: (item) => {
			return (item as unknown as { id: string }).id;
		},
		sync: {
			sync: (params) => {
				const { begin, write, commit, markReady } = params;

				async function initialSync() {
					try {
						const rows = await drizzle.select().from(table);

						begin();
						for (const row of rows) {
							write({
								type: "insert",
								value: row as InferSchemaOutput<
									InferSelectSchema<typeof table>
								>,
							});
						}
						commit();
					} catch (error) {
						console.error("Initial sync failed:", error);
						throw error;
					} finally {
						markReady();
					}
				}

				initialSync();

				return () => {
					// We don't need to clean up anything here
				};
			},
		},
		onInsert: async (params) => {
			const { transaction } = params;

			drizzle.transaction(async (tx) => {
				for (const mutation of transaction.mutations) {
					await tx
						.insert(table)
						.values(mutation.modified as SQLiteInsertValue<typeof table>);
				}
			});
		},
		onUpdate: async (params) => {
			const { transaction } = params;
			drizzle.transaction(async (tx) => {
				for (const mutation of transaction.mutations) {
					await tx
						.update(table)
						.set(mutation.changes as SQLiteUpdateSetSource<typeof table>)
						.where(eq(table.id, mutation.key));
				}
			});
		},
		onDelete: async (params) => {
			const { transaction, collection } = params;
			console.log(transaction, collection);
			drizzle.delete(table).where(
				inArray(
					table.id,
					transaction.mutations.map((mutation) => mutation.key),
				),
			);
		},
	};
}
