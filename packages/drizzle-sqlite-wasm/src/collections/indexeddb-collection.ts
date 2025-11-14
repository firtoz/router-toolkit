import type {
	CollectionConfig,
	InferSchemaOutput,
	SyncConfig,
	SyncConfigRes,
	SyncMode,
} from "@tanstack/db";
import type { IR } from "@tanstack/db";
import {
	extractSimpleComparisons,
	parseOrderByExpression,
	DeduplicatedLoadSubset,
} from "@tanstack/db";
import type { Table } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import type { SelectSchema } from "./collection-utils";

/**
 * Type for items stored in IndexedDB (must have required sync fields)
 */
export type IndexedDBSyncItem = {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	[key: string]: unknown;
};

export interface IndexedDBCollectionConfig<TTable extends Table> {
	/**
	 * The IndexedDB database instance
	 */
	indexedDB: IDBDatabase;
	/**
	 * The Drizzle table definition (used for schema and type inference only)
	 */
	table: TTable;
	/**
	 * The name of the IndexedDB object store (should match the table name)
	 */
	storeName: string;
	/**
	 * Promise that resolves when the database is ready
	 */
	readyPromise: Promise<void>;
	/**
	 * Sync mode: 'eager' (immediate) or 'lazy' (on-demand)
	 */
	syncMode?: SyncMode;
	/**
	 * Enable debug logging for index discovery and query optimization
	 */
	debug?: boolean;
}

/**
 * Evaluates a TanStack DB IR expression against an IndexedDB item
 */
function evaluateExpression(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
): boolean {
	if (expression.type === "ref") {
		const propRef = expression as IR.PropRef;
		const columnName = propRef.path[propRef.path.length - 1];
		return item[columnName as string] !== undefined;
	}

	if (expression.type === "val") {
		const value = expression as IR.Value;
		return !!value.value;
	}

	if (expression.type === "func") {
		const func = expression as IR.Func;

		switch (func.name) {
			case "eq": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left === right;
			}
			case "ne": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left !== right;
			}
			case "gt": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left > right;
			}
			case "gte": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left >= right;
			}
			case "lt": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left < right;
			}
			case "lte": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left <= right;
			}
			case "and": {
				return func.args.every((arg) => evaluateExpression(arg, item));
			}
			case "or": {
				return func.args.some((arg) => evaluateExpression(arg, item));
			}
			case "not": {
				return !evaluateExpression(func.args[0], item);
			}
			case "isNull": {
				const value = getExpressionValue(func.args[0], item);
				return value === null || value === undefined;
			}
			case "isNotNull": {
				const value = getExpressionValue(func.args[0], item);
				return value !== null && value !== undefined;
			}
			case "like": {
				const left = String(getExpressionValue(func.args[0], item));
				const right = String(getExpressionValue(func.args[1], item));
				// Convert SQL LIKE pattern to regex (case-sensitive)
				const pattern = right.replace(/%/g, ".*").replace(/_/g, ".");
				return new RegExp(`^${pattern}$`).test(left);
			}
			case "ilike": {
				const left = String(getExpressionValue(func.args[0], item));
				const right = String(getExpressionValue(func.args[1], item));
				// Convert SQL ILIKE pattern to regex (case-insensitive)
				const pattern = right.replace(/%/g, ".*").replace(/_/g, ".");
				return new RegExp(`^${pattern}$`, "i").test(left);
			}
			case "in": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				// Check if left value is in the right array
				return Array.isArray(right) && right.includes(left);
			}
			case "isUndefined": {
				const value = getExpressionValue(func.args[0], item);
				return value === null || value === undefined;
			}
			default:
				throw new Error(`Unsupported function: ${func.name}`);
		}
	}

	throw new Error(
		`Unsupported expression type: ${(expression as { type: string }).type}`,
	);
}

/**
 * Gets the value from an IR expression
 */
function getExpressionValue(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: We need any here for dynamic values
): any {
	if (expression.type === "ref") {
		const propRef = expression as IR.PropRef;
		const columnName = propRef.path[propRef.path.length - 1];
		return item[columnName as string];
	}

	if (expression.type === "val") {
		const value = expression as IR.Value;
		return value.value;
	}

	throw new Error(`Cannot get value from expression type: ${expression.type}`);
}

/**
 * Reads all items from an IndexedDB object store
 */
function getAllFromStore(
	db: IDBDatabase,
	storeName: string,
): Promise<IndexedDBSyncItem[]> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		const request = store.getAll();

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem[]);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Reads items from an IndexedDB index with an optional key range
 * Note: Index existence is validated at collection creation time
 */
function getAllFromIndex(
	db: IDBDatabase,
	storeName: string,
	indexName: string,
	keyRange?: IDBKeyRange,
): Promise<IndexedDBSyncItem[]> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		const index = store.index(indexName);
		const request = keyRange ? index.getAll(keyRange) : index.getAll();

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem[]);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Attempts to extract a simple indexed query from an IR expression
 * Returns the field name and key range if the query can be optimized
 *
 * NOTE: IndexedDB indexes are much more limited than SQL WHERE clauses:
 * - Only supports simple comparisons on a SINGLE indexed field
 * - Supported operators: eq, gt, gte, lt, lte
 * - Complex queries (AND, OR, NOT, multiple fields) fall back to in-memory filtering
 *
 * Indexes are auto-discovered from your Drizzle schema:
 * - Define indexes using index().on() in your schema
 * - Run migrations to create them in IndexedDB
 * - This collection automatically detects and uses them
 */
function tryExtractIndexedQuery(
	expression: IR.BasicExpression,
	indexes?: Record<string, string>,
): { fieldName: string; indexName: string; keyRange: IDBKeyRange } | null {
	if (!indexes) {
		return null;
	}

	try {
		// Use TanStack DB helper to extract simple comparisons
		const comparisons = extractSimpleComparisons(expression);

		// We can only use an index for a single field
		if (comparisons.length !== 1) {
			return null;
		}

		const comparison = comparisons[0];
		const fieldName = comparison.field.join(".");
		const indexName = indexes[fieldName];

		if (!indexName) {
			return null;
		}

		// Convert operator to IndexedDB key range
		let keyRange: IDBKeyRange | null = null;

		switch (comparison.operator) {
			case "eq":
				keyRange = IDBKeyRange.only(comparison.value);
				break;
			case "gt":
				keyRange = IDBKeyRange.lowerBound(comparison.value, true);
				break;
			case "gte":
				keyRange = IDBKeyRange.lowerBound(comparison.value, false);
				break;
			case "lt":
				keyRange = IDBKeyRange.upperBound(comparison.value, true);
				break;
			case "lte":
				keyRange = IDBKeyRange.upperBound(comparison.value, false);
				break;
			default:
				return null;
		}

		if (!keyRange) {
			return null;
		}

		return { fieldName, indexName, keyRange };
	} catch {
		// If extractSimpleComparisons fails, it's a complex query
		return null;
	}
}

/**
 * Adds an item to an IndexedDB object store using an existing transaction
 */
function addToStoreInTransaction(
	store: IDBObjectStore,
	item: IndexedDBSyncItem,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = store.add(item);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Updates an item in an IndexedDB object store using an existing transaction
 */
function updateInStoreInTransaction(
	store: IDBObjectStore,
	item: IndexedDBSyncItem,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = store.put(item);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Deletes an item from an IndexedDB object store using an existing transaction
 */
function deleteFromStoreInTransaction(
	store: IDBObjectStore,
	id: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = store.delete(id);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Gets a single item from an IndexedDB object store by ID
 */
function getFromStore(
	db: IDBDatabase,
	storeName: string,
	id: string,
): Promise<IndexedDBSyncItem | undefined> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		const request = store.get(id);

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem | undefined);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Gets a single item from an IndexedDB object store by ID using an existing transaction
 */
function getFromStoreInTransaction(
	store: IDBObjectStore,
	id: string,
): Promise<IndexedDBSyncItem | undefined> {
	return new Promise((resolve, reject) => {
		const request = store.get(id);

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem | undefined);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Executes a transaction and returns a promise that resolves when the transaction completes
 */
function commitTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => {
			resolve();
		};

		transaction.onerror = () => {
			reject(transaction.error);
		};

		transaction.onabort = () => {
			reject(new Error("Transaction aborted"));
		};
	});
}

/**
 * Auto-discovers indexes from the IndexedDB store
 * Returns a map of field names to index names for single-column indexes
 *
 * NOTE: Indexes are created automatically by Drizzle migrations based on your schema:
 *
 * @example
 * // In your schema.ts:
 * export const todoTable = syncableTable(
 *   "todo",
 *   { title: text("title"), userId: text("userId") },
 *   (t) => [
 *     index("todo_user_id_index").on(t.userId),
 *     index("todo_created_at_index").on(t.createdAt),
 *   ]
 * );
 *
 * // The migrator will automatically create these indexes in IndexedDB
 * // This collection will auto-detect and use them for optimized queries
 */
function discoverIndexes(
	db: IDBDatabase,
	storeName: string,
): Record<string, string> {
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);
	const indexMap: Record<string, string> = {};

	// Iterate through all indexes in the store
	for (const indexName of Array.from(store.indexNames)) {
		const index = store.index(indexName);
		const keyPath = index.keyPath;

		// Only map single-column indexes (string keyPath)
		// Compound indexes (array keyPath) are more complex and not currently optimized
		if (typeof keyPath === "string") {
			indexMap[keyPath] = indexName;
		}
	}

	return indexMap;
}

/**
 * Creates a TanStack DB collection config for IndexedDB
 */
export function indexedDBCollectionOptions<const TTable extends Table>(
	config: IndexedDBCollectionConfig<TTable>,
) {
	// Auto-discover indexes from the IndexedDB store
	// These are created by Drizzle migrations based on index() definitions in your schema
	const discoveredIndexes = discoverIndexes(config.indexedDB, config.storeName);

	if (config.debug && Object.keys(discoveredIndexes).length > 0) {
		console.log(
			`[IndexedDB Collection] Auto-discovered ${Object.keys(discoveredIndexes).length} indexes for ${config.storeName}:`,
			discoveredIndexes,
		);
	}

	type CollectionType = CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		SelectSchema<TTable>
	>;

	const table = config.table;

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

				const items = await getAllFromStore(config.indexedDB, config.storeName);

				for (const item of items) {
					write({
						type: "insert",
						value: item as unknown as InferSchemaOutput<SelectSchema<TTable>>,
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
				// Use a single transaction for all inserts
				const transaction = config.indexedDB.transaction(
					config.storeName,
					"readwrite",
				);
				const store = transaction.objectStore(config.storeName);

				const itemsToInsert: IndexedDBSyncItem[] = [];

				for (const item of params.transaction.mutations) {
					const now = new Date();
					const itemToInsert = {
						...item.modified,
						createdAt: now,
						updatedAt: now,
					} as IndexedDBSyncItem;

					itemsToInsert.push(itemToInsert);
					await addToStoreInTransaction(store, itemToInsert);
				}

				// Wait for transaction to complete
				await commitTransaction(transaction);

				// Read back the inserted items
				begin();
				for (const itemToInsert of itemsToInsert) {
					const inserted = await getFromStore(
						config.indexedDB,
						config.storeName,
						itemToInsert.id,
					);

					if (inserted) {
						write({
							type: "update",
							value: inserted as unknown as InferSchemaOutput<
								SelectSchema<TTable>
							>,
						});
					}
				}
				commit();
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
				// Use a single transaction for all updates
				const transaction = config.indexedDB.transaction(
					config.storeName,
					"readwrite",
				);
				const store = transaction.objectStore(config.storeName);

				const updatedKeys: string[] = [];

				for (const item of params.transaction.mutations) {
					const existing = await getFromStoreInTransaction(store, item.key);

					if (existing) {
						const updateTime = new Date();
						const updatedItem = {
							...existing,
							...item.changes,
							updatedAt: updateTime,
						} as IndexedDBSyncItem;

						await updateInStoreInTransaction(store, updatedItem);
						updatedKeys.push(item.key);
					}
				}

				// Wait for transaction to complete
				await commitTransaction(transaction);

				// Read back the updated items
				begin();
				for (const key of updatedKeys) {
					const updated = await getFromStore(
						config.indexedDB,
						config.storeName,
						key,
					);

					if (updated) {
						write({
							type: "update",
							value: updated as unknown as InferSchemaOutput<
								SelectSchema<TTable>
							>,
						});
					}
				}
				commit();
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
				// Use a single transaction for all deletes
				const transaction = config.indexedDB.transaction(
					config.storeName,
					"readwrite",
				);
				const store = transaction.objectStore(config.storeName);

				for (const item of params.transaction.mutations) {
					await deleteFromStoreInTransaction(store, item.key);
				}

				// Wait for transaction to complete
				await commitTransaction(transaction);
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
					let items: IndexedDBSyncItem[];

					// Try to use an index for efficient querying
					const indexedQuery = options.where
						? tryExtractIndexedQuery(options.where, discoveredIndexes)
						: null;

					if (indexedQuery) {
						// Use indexed query for better performance
						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] Using indexed query on ${indexedQuery.indexName}`,
							);
						}
						items = await getAllFromIndex(
							config.indexedDB,
							config.storeName,
							indexedQuery.indexName,
							indexedQuery.keyRange,
						);
					} else {
						// Fall back to getting all items
						items = await getAllFromStore(config.indexedDB, config.storeName);

						// Apply where filter in memory
						if (options.where) {
							const whereExpression = options.where;
							items = items.filter((item) =>
								evaluateExpression(
									whereExpression,
									item as Record<string, unknown>,
								),
							);
						}
					}

					// Apply orderBy
					if (options.orderBy) {
						const sorts = parseOrderByExpression(options.orderBy);
						items.sort((a, b) => {
							for (const sort of sorts) {
								// Access nested field (though typically will be single level)
								// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic field access
								let aValue: any = a;
								// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic field access
								let bValue: any = b;
								for (const fieldName of sort.field) {
									aValue = aValue?.[fieldName];
									bValue = bValue?.[fieldName];
								}

								if (aValue < bValue) {
									return sort.direction === "asc" ? -1 : 1;
								}
								if (aValue > bValue) {
									return sort.direction === "asc" ? 1 : -1;
								}
							}
							return 0;
						});
					}

					// Apply limit
					if (options.limit !== undefined) {
						items = items.slice(0, options.limit);
					}

					for (const item of items) {
						write({
							type: "insert",
							value: item as unknown as InferSchemaOutput<SelectSchema<TTable>>,
						});
					}

					commit();
				} catch (error) {
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
