import journal from './meta/_journal.json';
import m0000 from './meta/0000_snapshot.json';
import type { IndexedDBMigrationConfig } from '@firtoz/drizzle-indexeddb';

export default {
	journal,
	snapshots: {
		m0000
	}
} as IndexedDBMigrationConfig;
