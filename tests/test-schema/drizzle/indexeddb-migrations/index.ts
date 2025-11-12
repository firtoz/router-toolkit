import { migrate_0000 } from './0000_funny_penance';
import { migrate_0001 } from './0001_certain_supreme_intelligence';
import { migrate_0002 } from './0002_condemned_wendigo';
import { migrate_0003 } from './0003_groovy_tomorrow_man';
import { migrate_0004 } from './0004_peaceful_tusk';

export type IndexedDBMigrationFunction = (
	db: IDBDatabase,
	transaction: IDBTransaction,
) => Promise<void>;

export const migrations: IndexedDBMigrationFunction[] = [
	migrate_0000,
	migrate_0001,
	migrate_0002,
	migrate_0003,
	migrate_0004
];
