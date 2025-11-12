import journal from './meta/_journal.json';
import m0000 from './meta/0000_snapshot.json';
import m0001 from './meta/0001_snapshot.json';
import m0002 from './meta/0002_snapshot.json';
import m0003 from './meta/0003_snapshot.json';
import m0004 from './meta/0004_snapshot.json';
import type { IndexedDBMigrationConfig } from '@firtoz/drizzle-indexeddb';

export default {
	journal,
	snapshots: {
		m0000,
		m0001,
		m0002,
		m0003,
		m0004
	}
} as IndexedDBMigrationConfig;
