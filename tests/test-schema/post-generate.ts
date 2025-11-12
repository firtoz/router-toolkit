#!/usr/bin/env bun
/**
 * Post-generation script to generate IndexedDB migrations
 * This runs after `drizzle-kit generate` to create executable migration files
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
	JournalEntry,
	Journal,
	Snapshot,
	TableDefinition,
	ColumnDefinition,
	IndexDefinition,
} from "@firtoz/drizzle-utils";

const META_DIR = "./drizzle/meta";
const JOURNAL_PATH = join(META_DIR, "_journal.json");
const OUTPUT_DIR = "./drizzle/indexeddb-migrations";
const SNAPSHOTS_PATH = "./drizzle/snapshots.ts";

function generateMigrationCode(
	entry: JournalEntry,
	snapshot: Snapshot,
	prevSnapshot: Snapshot | null,
): string {
	const lines: string[] = [];
	const tableName = entry.tag.replace(/^\d+_/, "").replace(/_/g, " ");

	// Determine if db and transaction are used
	const currentTables: Record<string, TableDefinition> = snapshot.tables || {};
	const previousTables: Record<string, TableDefinition> =
		prevSnapshot?.tables || {};

	let needsTransaction = false;
	let needsDb = false;

	// Check for new tables (needs db)
	for (const tableName of Object.keys(currentTables)) {
		if (!previousTables[tableName]) {
			needsDb = true;
		}
	}

	// Check for deleted tables (needs db)
	for (const tableName of Object.keys(previousTables)) {
		if (!currentTables[tableName]) {
			needsDb = true;
		}
	}

	// Check for index changes (needs transaction and db)
	for (const [tableName, tableDef] of Object.entries(currentTables)) {
		if (previousTables[tableName]) {
			const newIndexes = tableDef.indexes || {};
			const oldIndexes = previousTables[tableName].indexes || {};
			const hasIndexChanges =
				Object.keys(newIndexes).length !== Object.keys(oldIndexes).length ||
				Object.keys(newIndexes).some((name) => !oldIndexes[name]);
			if (hasIndexChanges) {
				needsTransaction = true;
				needsDb = true;
				break;
			}
		}
	}

	const dbParam = needsDb ? "db: IDBDatabase" : "_db: IDBDatabase";
	const transactionParam = needsTransaction
		? "transaction: IDBTransaction"
		: "_transaction: IDBTransaction";

	lines.push(
		`/**`,
		` * Migration: ${tableName}`,
		` * Generated from: ${entry.tag}`,
		` */`,
		`export async function migrate_${entry.idx.toString().padStart(4, "0")}(`,
		`\t${dbParam},`,
		`\t${transactionParam},`,
		`): Promise<void> {`,
	);

	// Find new tables
	for (const [tableName, tableDef] of Object.entries(currentTables)) {
		if (!previousTables[tableName]) {
			lines.push(`\t// Create new table: ${tableName}`);
			lines.push(`\tif (!db.objectStoreNames.contains("${tableName}")) {`);

			// Find primary key
			const pkColumn = Object.values(
				tableDef.columns as Record<string, ColumnDefinition>,
			).find((col) => col.primaryKey);

			const hasIndexes = Object.keys(tableDef.indexes).length > 0;

			if (pkColumn) {
				if (hasIndexes) {
					lines.push(
						`\t\tconst store = db.createObjectStore("${tableName}", {`,
						`\t\t\tkeyPath: "${pkColumn.name}",`,
						`\t\t\tautoIncrement: ${pkColumn.autoincrement},`,
						`\t\t});`,
					);
				} else {
					lines.push(
						`\t\tdb.createObjectStore("${tableName}", {`,
						`\t\t\tkeyPath: "${pkColumn.name}",`,
						`\t\t\tautoIncrement: ${pkColumn.autoincrement},`,
						`\t\t});`,
					);
				}
			} else {
				if (hasIndexes) {
					lines.push(
						`\t\tconst store = db.createObjectStore("${tableName}", {`,
						`\t\t\tautoIncrement: true,`,
						`\t\t});`,
					);
				} else {
					lines.push(
						`\t\tdb.createObjectStore("${tableName}", {`,
						`\t\t\tautoIncrement: true,`,
						`\t\t});`,
					);
				}
			}

			// Create indexes
			for (const [indexName, indexDef] of Object.entries(tableDef.indexes)) {
				const keyPath =
					indexDef.columns.length === 1
						? `"${indexDef.columns[0]}"`
						: `[${indexDef.columns.map((c) => `"${c}"`).join(", ")}]`;

				lines.push(
					`\t\tstore.createIndex("${indexName}", ${keyPath}, { unique: ${indexDef.isUnique} });`,
				);
			}

			lines.push(`\t}`);
			lines.push("");
		} else {
			// Table exists, check for index changes
			const prevTableDef: TableDefinition = previousTables[tableName];
			const newIndexes: Record<string, IndexDefinition> =
				tableDef.indexes || {};
			const oldIndexes: Record<string, IndexDefinition> =
				prevTableDef.indexes || {};

			const hasIndexChanges =
				Object.keys(newIndexes).length !== Object.keys(oldIndexes).length ||
				Object.keys(newIndexes).some((name) => !oldIndexes[name]);

			if (hasIndexChanges) {
				lines.push(`\t// Update indexes for table: ${tableName}`);
				lines.push(`\tif (db.objectStoreNames.contains("${tableName}")) {`);
				lines.push(
					`\t\tconst store = transaction.objectStore("${tableName}");`,
				);
				lines.push("");

				// Remove old indexes
				for (const indexName of Object.keys(oldIndexes)) {
					if (!newIndexes[indexName]) {
						lines.push(
							`\t\tif (store.indexNames.contains("${indexName}")) {`,
							`\t\t\tstore.deleteIndex("${indexName}");`,
							`\t\t}`,
						);
					}
				}

				// Add new indexes
				for (const [indexName, indexDef] of Object.entries(newIndexes)) {
					if (!oldIndexes[indexName]) {
						const keyPath =
							indexDef.columns.length === 1
								? `"${indexDef.columns[0]}"`
								: `[${indexDef.columns.map((c) => `"${c}"`).join(", ")}]`;

						lines.push(
							`\t\tif (!store.indexNames.contains("${indexName}")) {`,
							`\t\t\tstore.createIndex("${indexName}", ${keyPath}, { unique: ${indexDef.isUnique} });`,
							`\t\t}`,
						);
					}
				}

				lines.push(`\t}`);
				lines.push("");
			}
		}
	}

	// Find deleted tables
	for (const tableName of Object.keys(previousTables)) {
		if (!currentTables[tableName]) {
			lines.push(
				`\t// Delete table: ${tableName}`,
				`\tif (db.objectStoreNames.contains("${tableName}")) {`,
				`\t\tdb.deleteObjectStore("${tableName}");`,
				`\t}`,
				"",
			);
		}
	}

	// If no changes detected, add a comment
	if (lines.length === 8) {
		lines.push(`\t// No IndexedDB schema changes needed for this migration`);
	}

	lines.push(`}`);

	return lines.join("\n");
}

try {
	// Read the journal
	const journalContent = readFileSync(JOURNAL_PATH, "utf-8");
	const journal: Journal = JSON.parse(journalContent);

	console.log(`[post-generate] Found ${journal.entries.length} migrations`);

	// Create output directory
	if (!existsSync(OUTPUT_DIR)) {
		mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	// Generate imports for snapshots.ts
	const snapshotImports: string[] = [
		"import journal from './meta/_journal.json';",
	];
	const snapshotKeys: string[] = [];
	const migrationImports: string[] = [];
	const migrationNames: string[] = [];

	// Load all snapshots and generate migrations
	const snapshots: Snapshot[] = [];

	for (const entry of journal.entries) {
		const snapshotKey = `m${entry.idx.toString().padStart(4, "0")}`;
		const fileName = `${entry.idx.toString().padStart(4, "0")}_snapshot.json`;
		const snapshotPath = join(META_DIR, fileName);

		// Load snapshot
		const snapshotContent = readFileSync(snapshotPath, "utf-8");
		const snapshot: Snapshot = JSON.parse(snapshotContent);
		snapshots.push(snapshot);

		// Add to snapshots.ts imports
		snapshotImports.push(`import ${snapshotKey} from './meta/${fileName}';`);
		snapshotKeys.push(snapshotKey);

		// Generate migration file
		const prevSnapshot = entry.idx > 0 ? snapshots[entry.idx - 1] : null;
		const migrationCode = generateMigrationCode(entry, snapshot, prevSnapshot);
		const migrationFileName = `${entry.tag}.ts`;
		const migrationPath = join(OUTPUT_DIR, migrationFileName);

		writeFileSync(migrationPath, migrationCode, "utf-8");
		console.log(`[post-generate] ✓ Generated ${migrationPath}`);

		// Add to index imports
		const migrationName = `migrate_${entry.idx.toString().padStart(4, "0")}`;
		migrationImports.push(`import { ${migrationName} } from './${entry.tag}';`);
		migrationNames.push(migrationName);
	}

	// Generate index.ts for migrations
	const indexContent = `${migrationImports.join("\n")}

export type IndexedDBMigrationFunction = (
\tdb: IDBDatabase,
\ttransaction: IDBTransaction,
) => Promise<void>;

export const migrations: IndexedDBMigrationFunction[] = [
\t${migrationNames.join(",\n\t")}
];
`;

	writeFileSync(join(OUTPUT_DIR, "index.ts"), indexContent, "utf-8");
	console.log(`[post-generate] ✓ Generated ${join(OUTPUT_DIR, "index.ts")}`);

	// Generate snapshots.ts
	const snapshotsContent = `${snapshotImports.join("\n")}
import type { IndexedDBMigrationConfig } from '@firtoz/drizzle-indexeddb';

export default {
\tjournal,
\tsnapshots: {
\t\t${snapshotKeys.join(",\n\t\t")}
\t}
} as IndexedDBMigrationConfig;
`;

	writeFileSync(SNAPSHOTS_PATH, snapshotsContent, "utf-8");
	console.log(`[post-generate] ✓ Generated ${SNAPSHOTS_PATH}`);
	console.log(`[post-generate] Migrations: ${migrationNames.join(", ")}`);
} catch (error) {
	console.error("[post-generate] Error:", error);
	process.exit(1);
}
