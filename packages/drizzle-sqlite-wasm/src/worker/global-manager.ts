import { SqliteWorkerManager } from "./manager";

let globalManager: SqliteWorkerManager | null = null;
let initPromise: Promise<SqliteWorkerManager> | null = null;

/**
 * Initialize the global SQLite worker manager.
 * Should be called once, early in your app (e.g., in entry.client.tsx).
 * Subsequent calls return the same manager instance.
 *
 * @example
 * ```typescript
 * // In entry.client.tsx
 * import { initializeSqliteWorker } from "@firtoz/drizzle-sqlite-wasm";
 * import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
 *
 * initializeSqliteWorker(SqliteWorker);
 * ```
 */
export function initializeSqliteWorker(
	WorkerConstructor: new () => Worker,
	debug: boolean = false,
): Promise<SqliteWorkerManager> {
	// Return existing init promise if initialization is in progress
	if (initPromise) {
		return initPromise;
	}

	// Return resolved promise if already initialized
	if (globalManager) {
		return Promise.resolve(globalManager);
	}

	// Start initialization

	console.log("[PERF] Starting global SQLite worker initialization");

	initPromise = (async () => {
		const worker = new WorkerConstructor();
		const manager = new SqliteWorkerManager(worker, debug);
		globalManager = manager;

		// Wait for the worker to actually send its Ready message
		await manager.ready;

		console.log("[PERF] Global SQLite worker manager ready");

		return manager;
	})();

	return initPromise;
}

/**
 * Get the global SQLite worker manager.
 * Throws an error if not initialized.
 */
export function getSqliteWorkerManager(): SqliteWorkerManager {
	if (!globalManager) {
		throw new Error(
			"SQLite worker manager not initialized. Call initializeSqliteWorker() first.",
		);
	}
	return globalManager;
}

/**
 * Check if the global manager has been initialized
 */
export function isSqliteWorkerInitialized(): boolean {
	return globalManager !== null;
}

/**
 * Reset the global manager (mainly for testing)
 */
export function resetSqliteWorkerManager() {
	if (globalManager) {
		globalManager.terminate();
	}
	globalManager = null;
	initPromise = null;
}
