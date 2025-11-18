export { drizzleSqliteWasm } from "./drizzle/direct";
export { SqliteWorkerClient } from "./worker/client";
export { sqliteCollectionOptions as drizzleCollectionOptions } from "./collections/sqlite-collection";
export { syncableTable } from "@firtoz/drizzle-utils";
export { makeId } from "@firtoz/drizzle-utils";
export type {
	IdOf,
	TableId,
	Branded,
	IdType,
	SelectSchema,
	InsertSchema,
} from "@firtoz/drizzle-utils";
export {
	indexedDBCollectionOptions,
	type IndexedDBCollectionConfig,
	type IndexedDBSyncItem,
} from "@firtoz/drizzle-indexeddb";
export { useDrizzleSqliteDb } from "./hooks/useDrizzleSqliteDb";
// SQLite WASM Provider
export {
	DrizzleSqliteProvider,
	DrizzleSqliteContext,
	useSqliteCollection,
} from "./context/DrizzleSqliteProvider";
export type { DrizzleSqliteContextValue } from "./context/DrizzleSqliteProvider";
export { useDrizzleSqlite } from "./context/useDrizzleSqlite";
export type { UseDrizzleSqliteReturn } from "./context/useDrizzleSqlite";

export {
	getPerformanceMetrics,
	getPerformanceMarks,
	logPerformanceMetrics,
	exportPerformanceData,
	clearPerformanceData,
	createPerformanceObserver,
} from "./utils/performance";
export type { PerformanceMetrics } from "./utils/performance";
export {
	initializeSqliteWorker,
	getSqliteWorkerManager,
	isSqliteWorkerInitialized,
	resetSqliteWorkerManager,
} from "./worker/global-manager";
export { SqliteWorkerManager, DbInstance } from "./worker/manager";
export type { ISqliteWorkerClient } from "./worker/manager";
export { customSqliteMigrate } from "./migration/migrator";
export type { DurableSqliteMigrationConfig } from "./migration/migrator";
