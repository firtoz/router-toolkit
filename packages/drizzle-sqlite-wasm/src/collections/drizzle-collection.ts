// const selectSchema = createSelectSchema(todoTable);

import type {
	CollectionConfig,
	InferSchemaOutput,
	SyncConfig,
	SyncConfigRes,
	SyncMode,
} from "@tanstack/db";
import type { IR } from "@tanstack/db";
import { DeduplicatedLoadSubset } from "@tanstack/db";
import {
	eq,
	sql,
	type BuildColumns,
	type Table,
	gt,
	gte,
	lt,
	lte,
	ne,
	and,
	or,
	not,
	isNull,
	isNotNull,
	like,
	inArray,
	asc,
	desc,
	SQL,
	getTableColumns,
} from "drizzle-orm";
import {
	integer,
	type SQLiteColumnBuilderBase,
	sqliteTable,
	text,
	type SQLiteTableWithColumns,
	type TableConfig,
	type SQLiteUpdateSetSource,
	type BaseSQLiteDatabase,
	type SQLiteTableExtraConfigValue,
	type SQLiteInsertValue,
} from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-valibot";
import type {
	Branded,
	IdType,
	TableId,
	IdOf,
	SelectSchema,
	InsertSchema,
} from "./collection-utils";
import { makeId } from "./collection-utils";

export type { Branded, IdType, TableId, IdOf, SelectSchema, InsertSchema };
export { makeId };

export const idColumn = text("id").primaryKey().$type<IdType>();

const createTableIdColumn = <TTableName extends string>() =>
	text("id")
		.primaryKey()
		.$type<TableId<TTableName>>()
		.$defaultFn(() => {
			return crypto.randomUUID() as TableId<TTableName>;
		});
// Use unixepoch with 'subsec' modifier for millisecond precision timestamps
export const createdAtColumn = integer("createdAt", { mode: "timestamp" })
	.$defaultFn(() => new Date())
	.notNull();
export const updatedAtColumn = integer("updatedAt", { mode: "timestamp" })
	.$defaultFn(() => new Date())
	.notNull();
export const deletedAtColumn = integer("deletedAt", {
	mode: "timestamp",
});

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
	extraConfig?: (
		self: BuildColumns<
			TTableName,
			Omit<TColumns, "id" | "createdAt" | "updatedAt" | "deletedAt"> & {
				id: ReturnType<typeof createTableIdColumn<TTableName>>;
				createdAt: typeof createdAtColumn;
				updatedAt: typeof updatedAtColumn;
				deletedAt: typeof deletedAtColumn;
			},
			"sqlite"
		>,
	) => SQLiteTableExtraConfigValue[],
) => {
	const tableIdColumn = createTableIdColumn<TTableName>();
	const table = sqliteTable(
		tableName,
		{
			id: tableIdColumn,
			createdAt: createdAtColumn,
			updatedAt: updatedAtColumn,
			deletedAt: deletedAtColumn,
			...columns,
		},
		extraConfig,
	);

	const tableColumns = getTableColumns(table);

	// console.log("table:", table);

	for (const columnName in tableColumns) {
		const column = tableColumns[columnName];

		let defaultValue: unknown | undefined;
		if (column.defaultFn) {
			defaultValue = column.defaultFn();
		} else if (column.default !== undefined) {
			defaultValue = column.default;
		}

		if (defaultValue instanceof SQL) {
			throw new Error(
				`Default value for column ${tableName}.${columnName} is a SQL expression, which is not supported for IndexedDB`,
			);
		}
	}

	return table;
};

type TableWithRequiredFields = SQLiteTableWithColumns<
	Pick<TableConfig, "name" | "schema" | "dialect"> & {
		columns: BuildColumns<
			string,
			{
				id: ReturnType<typeof createTableIdColumn<string>>;
				createdAt: typeof createdAtColumn;
				updatedAt: typeof updatedAtColumn;
				deletedAt: typeof deletedAtColumn;
			},
			"sqlite"
		>;
	}
>;

export type AnyDrizzleDatabase = BaseSQLiteDatabase<
	"async",
	// biome-ignore lint/suspicious/noExplicitAny: We really want to use any here.
	any,
	Record<string, unknown>
>;

export type DrizzleSchema<TDrizzle extends AnyDrizzleDatabase> =
	TDrizzle["_"]["fullSchema"];

export interface DrizzleCollectionConfig<
	TDrizzle extends AnyDrizzleDatabase,
	TTableName extends ValidTableNames<DrizzleSchema<TDrizzle>>,
> {
	drizzle: TDrizzle;
	tableName: ValidTableNames<DrizzleSchema<TDrizzle>> extends never
		? {
				$error: "The schema needs to include at least one table that uses the syncableTable function.";
			}
		: TTableName;
	readyPromise: Promise<void>;
	syncMode?: SyncMode;
	/**
	 * Enable debug logging for query execution and mutations
	 */
	debug?: boolean;
}

export type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[K in keyof TSchema]: TSchema[K] extends TableWithRequiredFields ? K : never;
}[keyof TSchema];

/**
 * Converts TanStack DB IR BasicExpression to Drizzle SQL expression
 */
function convertBasicExpressionToDrizzle<TTable extends Table>(
	expression: IR.BasicExpression,
	table: TTable,
): SQL {
	if (expression.type === "ref") {
		// PropRef - reference to a column
		const propRef = expression as IR.PropRef;
		const columnName = propRef.path[propRef.path.length - 1];
		const column = table[columnName as keyof typeof table];

		if (!column || typeof column !== "object" || !("_" in column)) {
			throw new Error(`Column ${String(columnName)} not found in table`);
		}

		// Drizzle columns can be used directly in expressions
		return column as unknown as SQL;
	}

	if (expression.type === "val") {
		// Value - literal value
		const value = expression as IR.Value;
		return sql`${value.value}`;
	}

	if (expression.type === "func") {
		// Func - function call like eq, gt, lt, etc.
		const func = expression as IR.Func;
		const args = func.args.map((arg) =>
			convertBasicExpressionToDrizzle(arg, table),
		);

		switch (func.name) {
			case "eq":
				return eq(args[0], args[1]);
			case "ne":
				return ne(args[0], args[1]);
			case "gt":
				return gt(args[0], args[1]);
			case "gte":
				return gte(args[0], args[1]);
			case "lt":
				return lt(args[0], args[1]);
			case "lte":
				return lte(args[0], args[1]);
			case "and": {
				const result = and(...args);
				if (!result) {
					throw new Error("Invalid 'and' expression - no arguments provided");
				}
				return result;
			}
			case "or": {
				const result = or(...args);
				if (!result) {
					throw new Error("Invalid 'or' expression - no arguments provided");
				}
				return result;
			}
			case "not":
				return not(args[0]);
			case "isNull":
				return isNull(args[0]);
			case "isNotNull":
				return isNotNull(args[0]);
			case "like":
				return like(args[0], args[1]);
			case "in":
				return inArray(args[0], args[1]);
			case "isUndefined":
				// isUndefined is same as isNull in SQLite
				return isNull(args[0]);
			default:
				throw new Error(`Unsupported function: ${func.name}`);
		}
	}

	throw new Error(
		`Unsupported expression type: ${(expression as { type: string }).type}`,
	);
}

/**
 * Converts TanStack DB OrderBy to Drizzle orderBy
 */
function convertOrderByToDrizzle<TTable extends Table>(
	orderBy: IR.OrderBy,
	table: TTable,
): SQL[] {
	return orderBy.map((clause) => {
		const expression = convertBasicExpressionToDrizzle(
			clause.expression,
			table,
		);
		const direction = clause.compareOptions.direction || "asc";

		return direction === "asc" ? asc(expression) : desc(expression);
	});
}

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

	const table = config.drizzle?._.fullSchema[tableName] as TTable;

	let insertListener: CollectionType["onInsert"] | null = null;
	let updateListener: CollectionType["onUpdate"] | null = null;
	let deleteListener: CollectionType["onDelete"] | null = null;

	const sync: SyncConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string
	>["sync"] = (params) => {
		const { begin, write, commit, markReady } = params;

		const initialSync = async () => {
			await config.readyPromise;

			try {
				begin();

				const items = (await config.drizzle
					.select()
					.from(table)) as unknown as InferSchemaOutput<SelectSchema<TTable>>[];

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

		if (config.syncMode === "eager" || !config.syncMode) {
			initialSync();
		} else {
			markReady();
		}

		insertListener = async (params) => {
			begin();
			for (const item of params.transaction.mutations) {
				if (config.debug) {
					console.log(
						`[${new Date().toISOString()}] insertListener write`,
						item,
					);
				}
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
								.returning()) as Array<InferSchemaOutput<SelectSchema<TTable>>>;

						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] insertListener result`,
								result,
							);
						}

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
				if (config.debug) {
					console.log(
						`[${new Date().toISOString()}] updateListener write`,
						item,
					);
				}
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
								.returning()) as Array<InferSchemaOutput<SelectSchema<TTable>>>;

						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] updateListener result`,
								result,
							);
						}

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
				if (config.debug) {
					console.log(
						`[${new Date().toISOString()}] deleteListener write`,
						item,
					);
				}
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

		// Create deduplicated loadSubset wrapper to avoid redundant queries
		const loadSubsetDedupe = new DeduplicatedLoadSubset({
			loadSubset: async (options) => {
				await config.readyPromise;

				begin();

				try {
					// Build the query with optional where, orderBy, and limit
					// Use $dynamic() to enable dynamic query building
					let query = config.drizzle.select().from(table).$dynamic();

					// Convert TanStack DB IR expressions to Drizzle expressions
					if (options.where) {
						const drizzleWhere = convertBasicExpressionToDrizzle(
							options.where,
							table,
						);
						query = query.where(drizzleWhere);
					}

					if (options.orderBy) {
						const drizzleOrderBy = convertOrderByToDrizzle(
							options.orderBy,
							table,
						);
						query = query.orderBy(...drizzleOrderBy);
					}

					if (options.limit !== undefined) {
						query = query.limit(options.limit);
					}

					const items = (await query) as unknown as InferSchemaOutput<
						SelectSchema<TTable>
					>[];

					for (const item of items) {
						write({
							type: "insert",
							value: item,
						});
					}

					commit();
				} catch (error) {
					// If there's an error, we should still commit to maintain consistency
					commit();
					throw error;
				}
			},
		});

		return {
			cleanup: () => {
				insertListener = null;
				updateListener = null;
				deleteListener = null;
				loadSubsetDedupe.reset();
			},
			loadSubset: loadSubsetDedupe.loadSubset,
		} satisfies SyncConfigRes;
	};

	return {
		schema: createSelectSchema(table),
		getKey: (item: InferSchemaOutput<SelectSchema<TTable>>) => {
			const id = (item as { id: string }).id;
			return id;
		},
		sync: {
			sync,
		},
		onInsert: async (
			params: Parameters<NonNullable<CollectionType["onInsert"]>>[0],
		) => {
			if (config.debug) {
				console.log("onInsert", params);
			}

			await insertListener?.(params);
		},
		onUpdate: async (
			params: Parameters<NonNullable<CollectionType["onUpdate"]>>[0],
		) => {
			if (config.debug) {
				console.log("onUpdate", params);
			}

			await updateListener?.(params);
		},
		onDelete: async (
			params: Parameters<NonNullable<CollectionType["onDelete"]>>[0],
		) => {
			if (config.debug) {
				console.log("onDelete", params);
			}

			await deleteListener?.(params);
		},
		syncMode: config.syncMode,
	} satisfies CollectionType;
}
