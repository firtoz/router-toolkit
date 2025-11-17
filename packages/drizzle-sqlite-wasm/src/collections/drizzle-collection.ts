// const selectSchema = createSelectSchema(todoTable);

import type {
	CollectionConfig,
	InferSchemaOutput,
	LoadSubsetOptions,
	SyncConfig,
	SyncConfigRes,
	SyncMode,
} from "@tanstack/db";
import type { IR } from "@tanstack/db";
import { DeduplicatedLoadSubset } from "@tanstack/db";
import {
	eq,
	sql,
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
	type SQL,
} from "drizzle-orm";
import type {
	SQLiteUpdateSetSource,
	BaseSQLiteDatabase,
	SQLiteInsertValue,
} from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-valibot";
import type {
	SelectSchema,
	TableWithRequiredFields,
} from "@firtoz/drizzle-utils";

// WORKAROUND: DeduplicatedLoadSubset has a bug where toggling queries (e.g., isNull/isNotNull)
// creates invalid expressions like not(or(isNull(...), not(isNull(...))))
// See: https://github.com/TanStack/db/issues/828
// TODO: Re-enable once the bug is fixed
const useDedupe = false as boolean;

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
			try {
				await config.drizzle.transaction(async (tx) => {
					begin();
					for (const item of params.transaction.mutations) {
						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] insertListener inserting`,
								item,
							);
						}

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
							// Write the actual result from the database (with defaults applied)
							write({
								type: "insert",
								value: result[0] as unknown as InferSchemaOutput<
									SelectSchema<TTable>
								>,
							});
						}
					}
					commit();
				});
			} catch (error) {
				// No need for rollback since we never wrote optimistically
				throw error;
			}
		};

		updateListener = async (params) => {
			try {
				await config.drizzle.transaction(async (tx) => {
					begin();
					for (const item of params.transaction.mutations) {
						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] updateListener updating`,
								item,
							);
						}

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
							// Write the actual result from the database
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
				// No need for rollback since we never wrote optimistically
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

		const loadSubset = async (options: LoadSubsetOptions) => {
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
		};

		// Create deduplicated loadSubset wrapper to avoid redundant queries
		let loadSubsetDedupe: DeduplicatedLoadSubset | null = null;
		if (useDedupe) {
			loadSubsetDedupe = new DeduplicatedLoadSubset({
				loadSubset,
			});
		}

		return {
			cleanup: () => {
				insertListener = null;
				updateListener = null;
				deleteListener = null;
				loadSubsetDedupe?.reset();
			},
			loadSubset: loadSubsetDedupe?.loadSubset ?? loadSubset,
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
