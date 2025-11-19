import { migrate_0000 } from './0000_luxuriant_power_pack';

export type IndexedDBMigrationFunction = (
	db: IDBDatabase,
	transaction: IDBTransaction,
) => Promise<void>;

export const migrations: IndexedDBMigrationFunction[] = [
	migrate_0000
];
