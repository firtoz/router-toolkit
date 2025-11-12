/**
 * Migration: groovy tomorrow man
 * Generated from: 0003_groovy_tomorrow_man
 */
export async function migrate_0003(
	db: IDBDatabase,
	transaction: IDBTransaction,
): Promise<void> {
	// Update indexes for table: todo
	if (db.objectStoreNames.contains("todo")) {
		const store = transaction.objectStore("todo");

		if (!store.indexNames.contains("todo_user_id_index")) {
			store.createIndex("todo_user_id_index", "user_id", { unique: false });
		}
		if (!store.indexNames.contains("todo_parent_id_index")) {
			store.createIndex("todo_parent_id_index", "parent_id", { unique: false });
		}
		if (!store.indexNames.contains("todo_completed_index")) {
			store.createIndex("todo_completed_index", "completed", { unique: false });
		}
		if (!store.indexNames.contains("todo_created_at_index")) {
			store.createIndex("todo_created_at_index", "createdAt", { unique: false });
		}
		if (!store.indexNames.contains("todo_updated_at_index")) {
			store.createIndex("todo_updated_at_index", "updatedAt", { unique: false });
		}
		if (!store.indexNames.contains("todo_deleted_at_index")) {
			store.createIndex("todo_deleted_at_index", "deletedAt", { unique: false });
		}
	}

	// Create new table: user
	if (!db.objectStoreNames.contains("user")) {
		const store = db.createObjectStore("user", {
			keyPath: "id",
			autoIncrement: false,
		});
		store.createIndex("email_index", "email", { unique: false });
	}

}