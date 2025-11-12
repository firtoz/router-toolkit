import { test, expect } from "@playwright/test";

test.describe("@firtoz/drizzle-sqlite-wasm - Partial IndexedDB Migrations", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/sqlite/indexeddb-migration-test");

		// Wait for page to load
		await page.waitForLoadState("networkidle");

		// Clean up any existing test database using the page context
		await page.evaluate(() => {
			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase("test-migration-db");
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
				request.onblocked = () => resolve();
			});
		});

		// Reload to reset state
		await page.reload();
	});

	test("should apply only pending migrations when some are already applied (3 of 5 applied)", async ({
		page,
	}) => {
		// Wait for page to load and check database
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Manually apply first 3 migrations (indices 0, 1, 2)
		await page.evaluate(async () => {
			// Access migrations from window (exposed by the component)
			const migrations = (window as any).testMigrations;

			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("test-migration-db", 3); // Version 3 = 3 migrations

				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					request.result.close();
					resolve();
				};

				request.onupgradeneeded = async (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					const transaction = (event.target as IDBOpenDBRequest).transaction;

					if (!transaction) {
						reject(new Error("No transaction"));
						return;
					}

					try {
						// Create migrations store
						if (!db.objectStoreNames.contains("__drizzle_migrations")) {
							const migrationStore = db.createObjectStore(
								"__drizzle_migrations",
								{
									keyPath: "id",
									autoIncrement: false,
								},
							);
							migrationStore.createIndex("appliedAt", "appliedAt", {
								unique: false,
							});
						}

						// Apply first 3 migrations
						for (let i = 0; i < 3; i++) {
							await migrations[i](db, transaction);

							// Record the migration
							const migrationStore = transaction.objectStore(
								"__drizzle_migrations",
							);
							migrationStore.add({
								id: i,
								appliedAt: Date.now(),
							});
						}
					} catch (error) {
						console.error("Manual migration failed:", error);
						transaction.abort();
						reject(error);
					}
				};
			});
		});

		// Reload the page to check the partial migration status
		await page.reload();

		// Wait for page to check database
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Should show 3 applied, 2 pending
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"3 applied",
		);
		await expect(page.getByTestId("pending-migrations-count")).toHaveText(
			"2 pending",
		);

		// Should show message about pending migrations
		await expect(page.getByTestId("migration-message")).toContainText(
			"3 migrations applied, 2 pending",
		);

		// Check applied migrations list
		await expect(page.getByTestId("applied-migrations-list")).toHaveText(
			"0, 1, 2",
		);

		// Database version should be 3
		await expect(page.getByTestId("db-version")).toHaveText("3");

		// Now run the migration to apply the remaining 2
		await page.getByTestId("run-migration-button").click();

		// Wait for migration to complete
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Should indicate only 2 new migrations were applied
		await expect(page.getByTestId("migration-message")).toContainText(
			"Successfully applied 2 migrations",
		);

		// Now all 5 should be applied
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"5 applied",
		);
		await expect(page.getByTestId("applied-migrations-list")).toHaveText(
			"0, 1, 2, 3, 4",
		);
		await expect(page.getByTestId("db-version")).toHaveText("5");

		// No pending migrations badge should be shown
		await expect(
			page.getByTestId("pending-migrations-count"),
		).not.toBeVisible();
	});

	test("should correctly identify partial migration state after page reload", async ({
		page,
	}) => {
		// Wait for idle status
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Manually apply first migration only (index 0)
		await page.evaluate(async () => {
			const migrations = (window as any).testMigrations;

			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("test-migration-db", 1);

				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					request.result.close();
					resolve();
				};

				request.onupgradeneeded = async (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					const transaction = (event.target as IDBOpenDBRequest).transaction;

					if (!transaction) {
						reject(new Error("No transaction"));
						return;
					}

					try {
						const migrationStore = db.createObjectStore(
							"__drizzle_migrations",
							{
								keyPath: "id",
								autoIncrement: false,
							},
						);
						migrationStore.createIndex("appliedAt", "appliedAt", {
							unique: false,
						});

						await migrations[0](db, transaction);

						migrationStore.add({
							id: 0,
							appliedAt: Date.now(),
						});
					} catch (error) {
						transaction.abort();
						reject(error);
					}
				};
			});
		});

		// Reload to check status
		await page.reload();

		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Should show 1 applied, 4 pending
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"1 applied",
		);
		await expect(page.getByTestId("pending-migrations-count")).toHaveText(
			"4 pending",
		);
		await expect(page.getByTestId("applied-migrations-list")).toHaveText("0");
		await expect(page.getByTestId("db-version")).toHaveText("1");
	});
});
