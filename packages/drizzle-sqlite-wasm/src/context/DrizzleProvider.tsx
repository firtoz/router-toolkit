import type { PropsWithChildren } from "react";
import { createContext, useRef, useMemo, useCallback, useEffect } from "react";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import {
	createCollection,
	type Collection,
	type InferSchemaOutput,
} from "@tanstack/db";
import type { Table } from "drizzle-orm";
import {
	type AnyDrizzleDatabase,
	type ValidTableNames,
	type DrizzleSchema,
	type SelectSchema,
	drizzleCollectionOptions,
} from "../collections/drizzle-collection";
import { useDrizzle } from "../hooks/useDrizzle";
import type { DurableSqliteMigrationConfig } from "../migration/migrator";

// Helper type to get the table from schema by name
type GetTableFromSchema<
	TSchema extends Record<string, unknown>,
	TTableName extends keyof TSchema,
> = TSchema[TTableName] extends Table ? TSchema[TTableName] : never;

// Helper type to infer the collection type from table - simplified to just the data type
type InferCollectionFromTable<TTable extends Table> = Collection<
	InferSchemaOutput<SelectSchema<TTable>>,
	string
>;

interface CollectionCacheEntry {
	// biome-ignore lint/suspicious/noExplicitAny: Cache needs to store collections of various types
	collection: Collection<any, string>;
	refCount: number;
}

export type DrizzleContextValue<TSchema extends Record<string, unknown>> = {
	drizzle: SqliteRemoteDatabase<TSchema>;
	getCollection: (
		tableName: string & ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>,
	) => Collection<
		InferSchemaOutput<
			SelectSchema<GetTableFromSchema<TSchema, typeof tableName>>
		>,
		string
	>;
	incrementRefCount: (
		tableName: string & ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>,
	) => void;
	decrementRefCount: (
		tableName: string & ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>,
	) => void;
};

// biome-ignore lint/suspicious/noExplicitAny: Context needs to accept any schema type
export const DrizzleContext = createContext<DrizzleContextValue<any> | null>(
	null,
);

type DrizzleProviderProps<TSchema extends Record<string, unknown>> =
	PropsWithChildren<{
		worker: new () => Worker;
		dbName: string;
		schema: TSchema;
		migrations: DurableSqliteMigrationConfig;
	}>;

export function DrizzleProvider<TSchema extends Record<string, unknown>>({
	children,
	worker,
	dbName,
	schema,
	migrations,
}: DrizzleProviderProps<TSchema>) {
	const { drizzle } = useDrizzle(worker, dbName, schema, migrations);
	// Collection cache with ref counting
	const collections = useMemo<Map<string, CollectionCacheEntry>>(
		() => new Map(),
		[],
	);

	const getCollection: DrizzleContextValue<TSchema>["getCollection"] =
		useCallback(
			(
				tableName: string & ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>,
			) => {
				const cacheKey = tableName;

				// Check if collection already exists in cache
				if (!collections.has(cacheKey)) {
					// Create new collection and cache it with ref count 0
					const collection = createCollection(
						drizzleCollectionOptions({
							drizzle,
							tableName,
						}),
					);
					collections.set(cacheKey, {
						collection,
						refCount: 0,
					});
				}

				// biome-ignore lint/style/noNonNullAssertion: We just ensured the collection exists
				return collections.get(cacheKey)!.collection;
			},
			[drizzle, collections],
		);

	const incrementRefCount: DrizzleContextValue<TSchema>["incrementRefCount"] =
		useCallback(
			(tableName: string) => {
				const entry = collections.get(tableName);
				if (entry) {
					entry.refCount++;
					console.log(
						`[Collection Cache] ${tableName} ref count: ${entry.refCount}`,
					);
				}
			},
			[collections],
		);

	const decrementRefCount: DrizzleContextValue<TSchema>["decrementRefCount"] =
		useCallback(
			(tableName: string) => {
				const entry = collections.get(tableName);
				if (entry) {
					entry.refCount--;
					console.log(
						`[Collection Cache] ${tableName} ref count: ${entry.refCount}`,
					);

					// If ref count reaches 0, remove from cache
					if (entry.refCount <= 0) {
						console.log(`[Collection Cache] Removing ${tableName} from cache`);
						collections.delete(tableName);
					}
				}
			},
			[collections],
		);

	const contextValue: DrizzleContextValue<TSchema> = useMemo(
		() => ({
			drizzle,
			getCollection,
			incrementRefCount,
			decrementRefCount,
		}),
		[drizzle, getCollection, incrementRefCount, decrementRefCount],
	);

	return (
		<DrizzleContext.Provider value={contextValue}>
			{children}
		</DrizzleContext.Provider>
	);
}

// Hook that components use to get a collection with automatic ref counting
export function useCollection<
	TSchema extends Record<string, unknown>,
	TTableName extends string & ValidTableNames<TSchema>,
>(
	context: DrizzleContextValue<TSchema>,
	tableName: TTableName,
): InferCollectionFromTable<GetTableFromSchema<TSchema, TTableName>> {
	const { collection, unsubscribe } = useMemo(() => {
		const tableNameTyped = tableName as string &
			ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>;

		// Get the collection and increment ref count
		const col = context.getCollection(tableNameTyped);
		context.incrementRefCount(tableNameTyped);

		// Return collection and unsubscribe function
		return {
			collection: col,
			unsubscribe: () => {
				context.decrementRefCount(tableNameTyped);
			},
		};
	}, [context, tableName]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			unsubscribe();
		};
	}, [unsubscribe]);

	return collection;
}
