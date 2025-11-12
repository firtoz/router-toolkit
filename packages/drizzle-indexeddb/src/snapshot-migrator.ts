// IndexedDB migrator that uses Drizzle snapshot files to create object stores and indexes

import type { Journal, Snapshot } from "@firtoz/drizzle-utils";

// ============================================================================
// Migration Config Types
// ============================================================================

export interface IndexedDBMigrationConfig {
	journal: Journal;
	snapshots: Record<string, Snapshot>;
}

interface MigrationRecord {
	id: number;
	tag: string;
	when: number;
	appliedAt: number;
}

const MIGRATIONS_STORE = "__drizzle_migrations";

/**
 * Opens an IndexedDB database and runs migrations if needed
 */
export async function migrateIndexedDB(
	dbName: string,
	config: IndexedDBMigrationConfig,
	debug: boolean = false,
): Promise<IDBDatabase> {
	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [IndexedDBMigrator] starting migration for database: ${dbName}`,
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
			`[${new Date().toISOString()}] [IndexedDBMigrator] latest applied migration index: ${latestAppliedIdx}`,
		);
	}

	// Determine which migrations need to be applied
	const pendingMigrations = config.journal.entries.filter(
		(entry) => entry.idx > latestAppliedIdx,
	);

	if (pendingMigrations.length === 0) {
		if (debug) {
			console.log(
				`[${new Date().toISOString()}] [IndexedDBMigrator] no pending migrations`,
			);
		}
		currentDb.close();
		// Re-open with correct version
		return await openDatabase(dbName, config.journal.entries.length);
	}

	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [IndexedDBMigrator] pending migrations: ${pendingMigrations.length}`,
			pendingMigrations.map((m) => m.tag),
		);
	}

	currentDb.close();

	// Calculate the target version (number of total migrations)
	const targetVersion = config.journal.entries.length;

	// Open database with version upgrade to trigger migration
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(dbName, targetVersion);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			const transaction = (event.target as IDBOpenDBRequest).transaction;

			if (!transaction) {
				reject(new Error("Transaction not available during upgrade"));
				return;
			}

			if (debug) {
				console.log(
					`[${new Date().toISOString()}] [IndexedDBMigrator] upgrade needed from version ${event.oldVersion} to ${event.newVersion}`,
				);
			}

			try {
				// Ensure migrations store exists
				if (!db.objectStoreNames.contains(MIGRATIONS_STORE)) {
					const migrationStore = db.createObjectStore(MIGRATIONS_STORE, {
						keyPath: "id",
						autoIncrement: false,
					});
					migrationStore.createIndex("tag", "tag", { unique: true });
					migrationStore.createIndex("when", "when", { unique: false });
				}

				// Apply each pending migration
				for (const journalEntry of pendingMigrations) {
					const snapshotKey = `m${journalEntry.idx.toString().padStart(4, "0")}`;
					const snapshot = config.snapshots[snapshotKey];

					if (!snapshot) {
						throw new Error(`Missing snapshot: ${snapshotKey}`);
					}

					// Get previous snapshot for comparison (if this isn't the first migration)
					const previousSnapshot =
						journalEntry.idx > 0
							? config.snapshots[
									`m${(journalEntry.idx - 1).toString().padStart(4, "0")}`
								]
							: null;

					if (debug) {
						console.log(
							`[${new Date().toISOString()}] [IndexedDBMigrator] applying migration ${journalEntry.idx}: ${journalEntry.tag}`,
						);
					}

					applySnapshot(db, snapshot, previousSnapshot, transaction, debug);

					// Record the migration
					const migrationStore = transaction.objectStore(MIGRATIONS_STORE);
					migrationStore.add({
						id: journalEntry.idx,
						tag: journalEntry.tag,
						when: journalEntry.when,
						appliedAt: Date.now(),
					});
				}

				if (debug) {
					console.log(
						`[${new Date().toISOString()}] [IndexedDBMigrator] all migrations applied successfully`,
					);
				}
			} catch (error) {
				console.error("[IndexedDBMigrator] Migration failed:", error);
				transaction.abort();
				reject(error);
			}
		};
	});

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
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
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
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
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

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

/**
 * Applies a snapshot to the database by creating/updating object stores and indexes
 */
function applySnapshot(
	db: IDBDatabase,
	snapshot: Snapshot,
	previousSnapshot: Snapshot | null,
	transaction: IDBTransaction,
	debug: boolean,
): void {
	// Process each table in the snapshot
	for (const [tableName, tableDefinition] of Object.entries(snapshot.tables)) {
		const storeExists = db.objectStoreNames.contains(tableName);
		let objectStore: IDBObjectStore;

		if (!storeExists) {
			// Create new object store
			if (debug) {
				console.log(
					`[${new Date().toISOString()}] [IndexedDBMigrator] creating object store: ${tableName}`,
				);
			}

			// Find the primary key column (optional in IndexedDB)
			const primaryKeyColumn = Object.entries(tableDefinition.columns).find(
				([_, col]) => col.primaryKey,
			);

			if (primaryKeyColumn) {
				// In-line key: Use the primary key column as keyPath
				const keyPath = primaryKeyColumn[0];
				const autoIncrement = primaryKeyColumn[1].autoincrement;

				objectStore = db.createObjectStore(tableName, {
					keyPath,
					autoIncrement,
				});
			} else {
				// Out-of-line key: No keyPath, can use auto-increment or external keys
				if (debug) {
					console.log(
						`[${new Date().toISOString()}] [IndexedDBMigrator] creating object store ${tableName} with out-of-line keys (no keyPath)`,
					);
				}
				objectStore = db.createObjectStore(tableName, {
					autoIncrement: true, // Auto-generate keys by default
				});
			}
		} else {
			// Get existing object store
			objectStore = transaction.objectStore(tableName);

			// Check if the primary key or autoIncrement has changed
			const primaryKeyColumn = Object.entries(tableDefinition.columns).find(
				([_, col]) => col.primaryKey,
			);

			// Determine expected key configuration
			const expectedKeyPath = primaryKeyColumn ? primaryKeyColumn[0] : null;
			const expectedAutoIncrement = primaryKeyColumn
				? primaryKeyColumn[1].autoincrement
				: true; // Default for out-of-line keys

			// Normalize keyPath for comparison (null, undefined, or empty string are all "no keyPath")
			const currentKeyPath = objectStore.keyPath || null;
			const normalizedExpectedKeyPath = expectedKeyPath || null;

			// Warn if key structure changed - this requires manual migration
			if (
				currentKeyPath !== normalizedExpectedKeyPath ||
				objectStore.autoIncrement !== expectedAutoIncrement
			) {
				const message =
					`[IndexedDBMigrator] Primary key structure changed for ${tableName}. ` +
					`This requires manual migration. ` +
					`Old keyPath: ${currentKeyPath || "(none)"}, new keyPath: ${normalizedExpectedKeyPath || "(none)"}. ` +
					`Old autoIncrement: ${objectStore.autoIncrement}, new autoIncrement: ${expectedAutoIncrement}. ` +
					`Consider exporting data, deleting the database, and re-importing.`;

				console.error(message);
				throw new Error(message);
			}
		}

		const currentIndexes = tableDefinition.indexes;

		// Remove indexes that no longer exist in the schema
		const existingIndexNames = Array.from(objectStore.indexNames);
		for (const existingIndexName of existingIndexNames) {
			if (!currentIndexes[existingIndexName]) {
				if (debug) {
					console.log(
						`[${new Date().toISOString()}] [IndexedDBMigrator] deleting index: ${existingIndexName} from ${tableName}`,
					);
				}
				objectStore.deleteIndex(existingIndexName);
			}
		}

		// Add or update indexes
		for (const [indexName, indexDef] of Object.entries(currentIndexes)) {
			const indexExists = objectStore.indexNames.contains(indexName);

			// IndexedDB indexes can only be on a single column or use an array keyPath
			const keyPath =
				indexDef.columns.length === 1 ? indexDef.columns[0] : indexDef.columns;

			if (indexExists) {
				// Check if index definition has changed
				const existingIndex = objectStore.index(indexName);
				const keyPathChanged = Array.isArray(keyPath)
					? JSON.stringify(existingIndex.keyPath) !== JSON.stringify(keyPath)
					: existingIndex.keyPath !== keyPath;
				const uniqueChanged = existingIndex.unique !== indexDef.isUnique;

				if (keyPathChanged || uniqueChanged) {
					if (debug) {
						console.log(
							`[${new Date().toISOString()}] [IndexedDBMigrator] recreating index: ${indexName} on ${tableName}`,
						);
					}
					// Recreate the index
					objectStore.deleteIndex(indexName);
					objectStore.createIndex(indexName, keyPath, {
						unique: indexDef.isUnique,
					});
				}
			} else {
				// Create new index
				if (debug) {
					console.log(
						`[${new Date().toISOString()}] [IndexedDBMigrator] creating index: ${indexName} on ${tableName}`,
					);
				}

				try {
					objectStore.createIndex(indexName, keyPath, {
						unique: indexDef.isUnique,
					});
				} catch (error) {
					console.error(
						`[${new Date().toISOString()}] [IndexedDBMigrator] failed to create index ${indexName}:`,
						error,
					);
					throw error;
				}
			}
		}
	}

	// Handle deleted tables
	if (previousSnapshot) {
		for (const tableName of Object.keys(previousSnapshot.tables)) {
			if (
				!snapshot.tables[tableName] &&
				db.objectStoreNames.contains(tableName)
			) {
				if (debug) {
					console.log(
						`[${new Date().toISOString()}] [IndexedDBMigrator] deleting object store: ${tableName}`,
					);
				}
				db.deleteObjectStore(tableName);
			}
		}
	}
}
