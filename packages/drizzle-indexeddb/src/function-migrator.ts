// IndexedDB migrator that executes generated migration functions

export type IndexedDBMigrationFunction = (
	db: IDBDatabase,
	transaction: IDBTransaction,
) => Promise<void>;

interface MigrationRecord {
	id: number;
	appliedAt: number;
}

const MIGRATIONS_STORE = "__drizzle_migrations";

/**
 * Runs IndexedDB migrations using generated migration functions
 *
 * Example usage:
 * ```typescript
 * import { migrations } from './drizzle/indexeddb-migrations';
 * import { migrateIndexedDBWithFunctions } from '@firtoz/drizzle-indexeddb';
 *
 * const db = await migrateIndexedDBWithFunctions('my-db', migrations, true);
 * ```
 */
export async function migrateIndexedDBWithFunctions(
	dbName: string,
	migrations: IndexedDBMigrationFunction[],
	debug: boolean = false,
): Promise<IDBDatabase> {
	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [PERF] IndexedDB migrator start for ${dbName}`,
		);
	}

	// First, open the database to check which migrations have been applied
	const currentDb = await openDatabaseForMigrationCheck(dbName);

	const appliedMigrations = await getAppliedMigrations(currentDb);

	const latestAppliedIdx =
		appliedMigrations.length > 0
			? Math.max(...appliedMigrations.map((m) => m.id))
			: -1;

	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [PERF] Latest applied migration index: ${latestAppliedIdx} (checked ${appliedMigrations.length} migrations)`,
		);
	}

	// Determine which migrations need to be applied
	const pendingMigrations = migrations
		.map((fn, idx) => ({ fn, idx }))
		.filter(({ idx }) => idx > latestAppliedIdx);

	if (pendingMigrations.length === 0) {
		if (debug) {
			console.log(
				`[${new Date().toISOString()}] [PERF] No pending migrations - database is up to date`,
			);
		}
		currentDb.close();
		// Re-open with correct version (migrations.length + 1 because version starts at 1)
		const db = await openDatabase(dbName, migrations.length + 1);
		if (debug) {
			console.log(
				`[${new Date().toISOString()}] [PERF] Migrator complete (no migrations needed)`,
			);
		}
		return db;
	}

	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [PERF] Found ${pendingMigrations.length} pending migrations to apply`,
		);
	}

	currentDb.close();

	// Calculate the target version (number of total migrations)
	const targetVersion = migrations.length;

	// Open database with version upgrade to trigger migration
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		// Use +1 here because first version is 1...
		const request = indexedDB.open(dbName, targetVersion + 1);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onupgradeneeded = async (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			const transaction = (event.target as IDBOpenDBRequest).transaction;

			if (!transaction) {
				reject(new Error("Transaction not available during upgrade"));
				return;
			}

			if (debug) {
				console.log(
					`[${new Date().toISOString()}] [PERF] Upgrade started: v${event.oldVersion} → v${event.newVersion}`,
				);
			}

			try {
				// Ensure migrations store exists
				if (!db.objectStoreNames.contains(MIGRATIONS_STORE)) {
					const migrationStore = db.createObjectStore(MIGRATIONS_STORE, {
						keyPath: "id",
						autoIncrement: false,
					});
					migrationStore.createIndex("appliedAt", "appliedAt", {
						unique: false,
					});
					if (debug) {
						console.log(
							`[${new Date().toISOString()}] [PERF] Created migrations tracking store`,
						);
					}
				}

				// Apply each pending migration
				for (const { fn, idx } of pendingMigrations) {
					if (debug) {
						console.log(
							`[${new Date().toISOString()}] [PERF] Applying migration ${idx}...`,
						);
					}

					// Execute the migration function
					await fn(db, transaction);

					// Record the migration
					const migrationStore = transaction.objectStore(MIGRATIONS_STORE);
					migrationStore.add({
						id: idx,
						appliedAt: Date.now(),
					});

					if (debug) {
						console.log(
							`[${new Date().toISOString()}] [PERF] Migration ${idx} complete`,
						);
					}
				}

				if (debug) {
					console.log(
						`[${new Date().toISOString()}] [PERF] All ${pendingMigrations.length} migrations applied successfully`,
					);
				}
			} catch (error) {
				console.error("[IndexedDBMigrator] Migration failed:", error);
				transaction.abort();
				reject(error);
			}
		};
	});

	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [PERF] Migrator complete - database ready`,
		);
	}

	return db;
}

/**
 * Opens database for checking migrations (without triggering upgrade)
 */
async function openDatabaseForMigrationCheck(
	dbName: string,
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName);
		request.onerror = () => {
			reject(request.error);
		};
		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

/**
 * Opens database with a specific version
 */
async function openDatabase(
	dbName: string,
	version: number,
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, version);
		request.onerror = () => {
			reject(request.error);
		};
		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

/**
 * Gets the list of applied migrations from the database
 */
async function getAppliedMigrations(
	db: IDBDatabase,
): Promise<MigrationRecord[]> {
	if (!db.objectStoreNames.contains(MIGRATIONS_STORE)) {
		return [];
	}

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(MIGRATIONS_STORE, "readonly");

		const store = transaction.objectStore(MIGRATIONS_STORE);

		const request = store.getAll();

		request.onerror = () => {
			reject(request.error);
		};
		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}
