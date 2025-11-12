// Adapted from https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/durable-sqlite/migrator.ts
// Adaptation date: 26/10/2025 20:28 commit 9cf0ed2

import { sql } from "drizzle-orm";
import type { MigrationMeta } from "drizzle-orm/migrator";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import type { migrate as durableSqliteMigrate } from "drizzle-orm/durable-sqlite/migrator";

export type DurableSqliteMigrationConfig = Parameters<
	typeof durableSqliteMigrate
>[1];

function readMigrationFiles({
	journal,
	migrations,
}: DurableSqliteMigrationConfig): MigrationMeta[] {
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

export async function customSqliteMigrate<
	TSchema extends Record<string, unknown>,
>(
	db: SqliteRemoteDatabase<TSchema>,
	config: DurableSqliteMigrationConfig,
	debug: boolean = false,
): Promise<void> {
	if (debug) {
		console.log(
			`[${new Date().toISOString()}] [SqliteWasmMigrator] migrating database`,
			config,
		);
	}

	const migrations = readMigrationFiles(config);
	let currentStatement: string | null = null;

	let migrationCount = 0;
	let success = true;

	await db.transaction(async (tx) => {
		try {
			const migrationsTable = "__drizzle_migrations";

			await tx.run(sql`
				CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
					id SERIAL PRIMARY KEY,
					hash text NOT NULL,
					created_at numeric
				)
			`);

			const dbMigrations = await tx.values<[number, string, string]>(
				sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`,
			);

			const lastDbMigration = dbMigrations[0] ?? undefined;

			if (debug) {
				console.log(
					`[${new Date().toISOString()}] [SqliteWasmMigrator] last db migration`,
					lastDbMigration,
				);
			}

			for (const migration of migrations) {
				if (
					!lastDbMigration ||
					Number(lastDbMigration[2]) < migration.folderMillis
				) {
					for (const stmt of migration.sql) {
						currentStatement = stmt;
						if (debug) {
							console.log(
								`[${new Date().toISOString()}] [SqliteWasmMigrator] running migration`,
								stmt,
							);
						}
						await tx.run(sql.raw(stmt));
						currentStatement = null;
					}
					await tx.run(
						sql`INSERT INTO ${sql.identifier(
							migrationsTable,
						)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`,
					);
					migrationCount++;
				}
			}
		} catch (error: unknown) {
			const e = error instanceof Error ? error : new Error(String(error));
			console.error("[Sqlite WASM Migrator] Database migration failed:", {
				error: e,
				errorMessage: e.message,
				errorStack: e.stack,
				migrations: Object.keys(migrations),
				...(currentStatement && { failedStatement: currentStatement }),
			});
			tx.rollback();
			success = false;
			throw e;
		}
	});

	if (debug) {
		if (!success) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWasmMigrator] migration failed.`,
			);
			return;
		}

		if (migrationCount > 0) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWasmMigrator] migration completed. migrations count: ${migrationCount} migrations applied.`,
			);
		} else {
			console.log(
				`[${new Date().toISOString()}] [SqliteWasmMigrator] no migrations applied.`,
			);
		}
	}
}
