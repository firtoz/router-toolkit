// const selectSchema = createSelectSchema(todoTable);

import {
	createCollection,
	type CollectionConfig,
	type InferSchemaOutput,
} from "@tanstack/db";
import { eq, sql, type BuildColumns, type Table } from "drizzle-orm";
import {
	integer,
	type SQLiteColumnBuilderBase,
	sqliteTable,
	text,
	type SQLiteTableWithColumns,
	type TableConfig,
	type SQLiteInsertValue,
	type SQLiteUpdateSetSource,
	type BaseSQLiteDatabase,
} from "drizzle-orm/sqlite-core";
// import type { SqliteRemoteDatabase, SqliteRemoteResult } from "drizzle-orm/sqlite-proxy";
import { type BuildSchema, createSelectSchema } from "drizzle-zod";
import { useMemo } from "react";

export const idColumn = text("id").primaryKey();
export const createdAtColumn = integer("createdAt", { mode: "timestamp" })

	.default(sql`(current_timestamp)`)
	.notNull();
export const updatedAtColumn = integer("updatedAt", { mode: "timestamp" })
	.default(sql`(current_timestamp)`)
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

type AnyDrizzleDatabase = BaseSQLiteDatabase<
	"async",
	any,
	Record<string, unknown>
>;

export type DrizzleSchema<TDrizzle extends AnyDrizzleDatabase> =
	TDrizzle["_"]["fullSchema"];

interface DrizzleCollectionConfig<
	TDrizzle extends AnyDrizzleDatabase,
	TTableName extends ValidTableNames<DrizzleSchema<TDrizzle>>,
> {
	drizzle: TDrizzle;
	tableName: ValidTableNames<DrizzleSchema<TDrizzle>> extends never
		? {
				$error: "The schema needs to include at least one table that uses the syncableTable function.";
			}
		: TTableName;
}

export type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[K in keyof TSchema]: TSchema[K] extends TableWithRequiredFields ? K : never;
}[keyof TSchema];

export function drizzleCollectionOptions<
	const TDrizzle extends AnyDrizzleDatabase,
	const TTableName extends string & ValidTableNames<DrizzleSchema<TDrizzle>>,
	TTable extends DrizzleSchema<TDrizzle>[TTableName] & TableWithRequiredFields,
>(config: DrizzleCollectionConfig<TDrizzle, TTableName>) {
	type CollectionType = CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		SelectSchema<TTable>
	>;

	const tableName = config.tableName as string &
		ValidTableNames<DrizzleSchema<TDrizzle>>;

	const table = config.drizzle._.fullSchema[tableName] as TTable;

	let insertListener: CollectionType["onInsert"] | null = null;
	let updateListener: CollectionType["onUpdate"] | null = null;
	let deleteListener: CollectionType["onDelete"] | null = null;

	return {
		schema: createSelectSchema(table),
		getKey: (item: InferSchemaOutput<SelectSchema<TTable>>) => {
			const id = (item as { id: string }).id;
			return id;
		},
		sync: {
			sync: (params: Parameters<CollectionType["sync"]["sync"]>[0]) => {
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

				insertListener = async (params) => {
					begin();
					for (const item of params.transaction.mutations) {
						console.log(
							`[${new Date().toISOString()}] insertListener write`,
							item,
						);
						write({
							type: "insert",
							value: item.modified,
						});
					}
					commit();

					try {
						await config.drizzle.transaction(async (tx) => {
							begin();
							for (const item of params.transaction.mutations) {
								const result: Array<InferSchemaOutput<SelectSchema<TTable>>> =
									(await tx
										.insert(table)
										.values(item.modified as SQLiteInsertValue<typeof table>)
										.returning()) as Array<
										InferSchemaOutput<SelectSchema<TTable>>
									>;

								console.log(
									`[${new Date().toISOString()}] insertListener result`,
									result,
								);

								if (result.length > 0) {
									write({
										type: "update",
										value: result[0] as unknown as InferSchemaOutput<
											SelectSchema<TTable>
										>,
									});
								}
							}
							commit();
						});
					} catch (error) {
						begin();
						for (const item of params.transaction.mutations) {
							write({
								type: "delete",
								value: item.modified,
							});
						}
						commit();

						throw error;
					}
				};

				updateListener = async (params) => {
					begin();
					for (const item of params.transaction.mutations) {
						console.log(
							`[${new Date().toISOString()}] updateListener write`,
							item,
						);
						write({
							type: "update",
							value: item.modified,
						});
					}
					commit();

					try {
						await config.drizzle.transaction(async (tx) => {
							begin();
							for (const item of params.transaction.mutations) {
								const updateTime = new Date();
								const result: Array<InferSchemaOutput<SelectSchema<TTable>>> =
									(await tx
										.update(table)
										.set({
											...item.changes,
											updatedAt: updateTime,
										} as SQLiteUpdateSetSource<typeof table>)
										.where(eq(table.id, item.key))
										.returning()) as Array<
										InferSchemaOutput<SelectSchema<TTable>>
									>;

								console.log(
									`[${new Date().toISOString()}] updateListener result`,
									result,
								);

								if (result.length > 0) {
									write({
										type: "update",
										value: result[0] as unknown as InferSchemaOutput<
											SelectSchema<TTable>
										>,
									});
								}
							}
							commit();
						});
					} catch (error) {
						begin();
						for (const item of params.transaction.mutations) {
							const original = item.original;
							write({
								type: "update",
								value: original,
							});
						}
						commit();

						throw error;
					}
				};

				deleteListener = async (params) => {
					begin();
					for (const item of params.transaction.mutations) {
						console.log(
							`[${new Date().toISOString()}] deleteListener write`,
							item,
						);
						write({
							type: "delete",
							value: item.modified,
						});
					}
					commit();

					try {
						await config.drizzle.transaction(async (tx) => {
							for (const item of params.transaction.mutations) {
								await tx.delete(table).where(eq(table.id, item.key));
							}
						});
					} catch (error) {
						begin();
						for (const item of params.transaction.mutations) {
							const original = item.original;
							write({
								type: "insert",
								value: original,
							});
						}
						commit();

						throw error;
					}
				};

				return () => {
					insertListener = null;
					updateListener = null;
					deleteListener = null;
				};
			},
		},
		onInsert: async (
			params: Parameters<NonNullable<CollectionType["onInsert"]>>[0],
		) => {
			console.log("onInsert", params);

			await insertListener?.(params);
		},
		onUpdate: async (
			params: Parameters<NonNullable<CollectionType["onUpdate"]>>[0],
		) => {
			console.log("onUpdate", params);

			await updateListener?.(params);
		},
		onDelete: async (
			params: Parameters<NonNullable<CollectionType["onDelete"]>>[0],
		) => {
			console.log("onDelete", params);

			await deleteListener?.(params);
		},
	};
}

export const useDrizzleCollection = <
	const TDrizzle extends AnyDrizzleDatabase,
	const TTableName extends string & ValidTableNames<DrizzleSchema<TDrizzle>>,
>(
	config: DrizzleCollectionConfig<TDrizzle, TTableName>,
) => {
	return useMemo(() => {
		return createCollection(
			drizzleCollectionOptions({
				drizzle: config.drizzle,
				tableName: config.tableName,
			}),
		);
	}, [config.drizzle, config.tableName]);
};
