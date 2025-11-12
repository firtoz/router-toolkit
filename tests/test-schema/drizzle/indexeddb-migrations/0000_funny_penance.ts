/**
 * Migration: funny penance
 * Generated from: 0000_funny_penance
 */
export async function migrate_0000(
	db: IDBDatabase,
	_transaction: IDBTransaction,
): Promise<void> {
	// Create new table: todo
	if (!db.objectStoreNames.contains("todo")) {
		db.createObjectStore("todo", {
			keyPath: "id",
			autoIncrement: false,
		});
	}

}