// Adapted from https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/durable-sqlite/migrator.ts
// Adaptation date: 26/10/2025 20:28 commit 9cf0ed2

import { sql } from "drizzle-orm";
import type { MigrationMeta } from "drizzle-orm/migrator";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

interface MigrationConfig {
	journal: {
		entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
	};
	migrations: Record<string, string>;
}

function readMigrationFiles({
	journal,
	migrations,
}: MigrationConfig): MigrationMeta[] {
	const migrationQueries: MigrationMeta[] = [];

	for (const journalEntry of journal.entries) {
		const query =
			migrations[`m${journalEntry.idx.toString().padStart(4, "0")}`];

		if (!query) {
			throw new Error(`Missing migration: ${journalEntry.tag}`);
		}

		try {
			const result = query.split("--> statement-breakpoint").map((it) => {
				return it;
			});

			migrationQueries.push({
				sql: result,
				bps: journalEntry.breakpoints,
				folderMillis: journalEntry.when,
				hash: "",
			});
		} catch {
			throw new Error(`Failed to parse migration: ${journalEntry.tag}`);
		}
	}

	return migrationQueries;
}

export async function migrate<TSchema extends Record<string, unknown>>(
	db: SqliteRemoteDatabase<TSchema>,
	config: MigrationConfig,
): Promise<void> {
	const migrations = readMigrationFiles(config);

	db.transaction(async (tx) => {
		try {
			const migrationsTable = "__drizzle_migrations";

			const migrationTableCreate = sql`
				CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
					id SERIAL PRIMARY KEY,
					hash text NOT NULL,
					created_at numeric
				)
			`;
			tx.run(migrationTableCreate);

			const dbMigrations = await tx.values<[number, string, string]>(
				sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`,
			);

			const lastDbMigration = dbMigrations[0] ?? undefined;

			for (const migration of migrations) {
				if (
					!lastDbMigration ||
					Number(lastDbMigration[2]) < migration.folderMillis
				) {
					for (const stmt of migration.sql) {
						db.run(sql.raw(stmt));
					}
					db.run(
						sql`INSERT INTO ${sql.identifier(
							migrationsTable,
						)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`,
					);
				}
			}
		} catch (error: unknown) {
			const e = error instanceof Error ? error : new Error(String(error));
			console.error("[Sqlite WASM Migrator] Database migration failed:", {
				error: e,
				errorMessage: e.message,
				errorStack: e.stack,
				migrations: Object.keys(migrations),
			});
			tx.rollback();
			throw e;
		}
	});
}

// interface MigrationConfig {
// 	journal: {
// 		entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
// 	};
// 	migrations: Record<string, string>;
// }

// function readMigrationFiles({
// 	journal,
// 	migrations,
// }: MigrationConfig): MigrationMeta[] {
// 	const migrationQueries: MigrationMeta[] = [];

// 	for (const journalEntry of journal.entries) {
// 		const query =
// 			migrations[`m${journalEntry.idx.toString().padStart(4, "0")}`];

// 		if (!query) {
// 			throw new Error(`Missing migration: ${journalEntry.tag}`);
// 		}

// 		try {
// 			const result = query.split("--> statement-breakpoint").map((it) => {
// 				return it;
// 			});

// 			migrationQueries.push({
// 				sql: result,
// 				bps: journalEntry.breakpoints,
// 				folderMillis: journalEntry.when,
// 				hash: "",
// 			});
// 		} catch {
// 			throw new Error(`Failed to parse migration: ${journalEntry.tag}`);
// 		}
// 	}

// 	return migrationQueries;
// }

// export async function migrate<TSchema extends Record<string, unknown>>(
// 	db: SqliteRemoteDatabase<TSchema>,
// 	config: MigrationConfig,
// 	debug = false,
// ): Promise<void> {
// 	const migrations = readMigrationFiles(config);

// 	if (debug) {
// 		console.log("Migrations:", migrations);
// 	}

// 	await db.transaction(async (tx) => {
// 		try {
// 			const migrationsTable = "__drizzle_migrations";

// 			if (debug) {
// 				console.log("Migrations table:", migrationsTable);
// 			}

// 			const migrationTableCreate = sql`
// 				CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
// 					id SERIAL PRIMARY KEY,
// 					hash text NOT NULL,
// 					created_at numeric
// 				)
// 			`;

// 			if (debug) {
// 				console.log("Migration table create:", migrationTableCreate);
// 			}

// 			await tx.run(migrationTableCreate);

// 			const dbMigrations = await tx.values<[number, string, string]>(
// 				sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`,
// 			);

// 			const lastDbMigration =
// 				dbMigrations.length > 0 ? dbMigrations[0] : undefined;

// 			const applied = 0;

// 			for (const migration of migrations) {
// 				if (
// 					!lastDbMigration ||
// 					// biome-ignore lint/style/noNonNullAssertion: <explanation>
// 					Number(lastDbMigration[2])! < migration.folderMillis
// 				) {
// 					if (debug) {
// 						console.log("Applying migration:", migration);
// 					}
// 					for (const stmt of migration.sql) {
// 						if (debug) {
// 							console.log("Applying statement:", stmt);
// 						}
// 						await tx.run(sql.raw(stmt));
// 					}
// 					if (debug) {
// 						console.log("Inserting migration:", migration);
// 					}
// 					await tx.run(
// 						sql`INSERT INTO ${sql.identifier(
// 							migrationsTable,
// 						)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`,
// 					);
// 				}
// 			}

// 			if (debug) {
// 				console.log("Applied", applied, "migrations");
// 			}
// 		} catch (error: unknown) {
// 			const e = error instanceof Error ? error : new Error(String(error));
// 			console.error("[Sqlite WASM Migrator] Database migration failed:", {
// 				error: e,
// 				errorMessage: e.message,
// 				errorStack: e.stack,
// 				migrations: Object.keys(migrations),
// 			});
// 			tx.rollback();
// 			throw error;
// 		}
// 	});
// }
