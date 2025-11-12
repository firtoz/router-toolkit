export { drizzleSqliteWasm } from "./drizzle/direct";
export { SqliteWorkerClient } from "./worker/client";
export {
	drizzleCollectionOptions,
	syncableTable,
	makeId,
} from "./collections/drizzle-collection";
export type { IdOf, TableId } from "./collections/drizzle-collection";
export { useDrizzle } from "./hooks/useDrizzle";
export {
	DrizzleProvider,
	DrizzleContext,
	useCollection,
} from "./context/DrizzleProvider";
export type { DrizzleContextValue } from "./context/DrizzleProvider";
export { useDrizzleContext } from "./context/useDrizzleContext";
export type { UseDrizzleContextReturn } from "./context/useDrizzleContext";
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
