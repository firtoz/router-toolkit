import { expect, test, type Page } from "@playwright/test";

/**
 * Unified E2E tests for both SQLite WASM and IndexedDB collections
 *
 * These tests verify that both collection implementations provide the same
 * rich feature set with consistent behavior:
 * - Basic CRUD operations
 * - Inline editing
 * - Bulk selection and operations
 * - Soft delete (deletedAt)
 * - Statistics display
 * - Show/hide deleted items
 * - Concurrent operations
 */

const COLLECTION_CONFIGS = [
	{
		name: "SQLite WASM",
		url: "/collections/sqlite-test",
		dbName: "sqlite-unified",
		clearDb: async (page: Page) => {
			await clearOPFS(page);
		},
	},
	{
		name: "IndexedDB",
		url: "/collections/indexeddb-test",
		dbName: "indexeddb-unified",
		clearDb: async (page: Page) => {
			await page.evaluate(() => {
				indexedDB.deleteDatabase("test-indexeddb.db");
			});
		},
	},
] as const;

// Helper to clear OPFS storage (for SQLite)
async function clearOPFS(page: Page) {
	await page.evaluate(async () => {
		try {
			const root = await navigator.storage.getDirectory();
			// @ts-expect-error - removeEntry is available in OPFS
			for await (const entry of root.values()) {
				try {
					await root.removeEntry(entry.name, { recursive: true });
				} catch (e) {
					console.log(`Failed to remove ${entry.name}:`, e);
				}
			}
		} catch (e) {
			console.log("Failed to clear OPFS:", e);
		}
	});
}

for (const config of COLLECTION_CONFIGS) {
	test.describe(`Unified Collections - ${config.name}`, () => {
		test.beforeEach(async ({ page }) => {
			// Clear storage before each test
			await page.goto("/");
			await config.clearDb(page);
		});

		test("should initialize and display empty state", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Should show title and description
			await expect(page.locator("h1")).toBeVisible();
			await expect(page.locator("p").first()).toBeVisible();

			// Should show statistics
			await expect(page.getByText("Total")).toBeVisible();
			await expect(page.getByText("Pending")).toBeVisible();
			await expect(page.getByText("Done")).toBeVisible();

			// Should show input form
			await expect(page.getByPlaceholder("Add a new task...")).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Add Task" }),
			).toBeVisible();

			// Should show empty state
			await expect(page.getByText("No tasks yet")).toBeVisible();
		});

		test("should add and display a new task", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			const input = page.getByTestId("todo-input");
			const addButton = page.getByTestId("add-task-button");

			// Add a task
			await input.fill("Test Task");
			await addButton.click();

			// Should see the task
			await expect(page.getByTestId("todo-list")).toBeVisible({
				timeout: 3000,
			});
			await expect(
				page.locator("[data-testid^='todo-title-']").first(),
			).toHaveValue("Test Task");

			// Statistics should update
			await expect(page.getByTestId("count-total")).toHaveText("1");
			await expect(page.getByTestId("count-pending")).toHaveText("1");
		});

		test("should support inline editing", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Original Title");
			await page.getByTestId("add-task-button").click();

			// Wait for task to appear
			const taskInput = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskInput).toBeVisible({ timeout: 3000 });
			await expect(taskInput).toHaveValue("Original Title");

			// Edit the task
			await taskInput.click();
			await taskInput.fill("Updated Title");
			await taskInput.press("Enter");

			// Wait for update to persist
			await page.waitForTimeout(300);

			// Should see updated title
			await expect(taskInput).toHaveValue("Updated Title", { timeout: 2000 });
		});

		test("should toggle task completion", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByPlaceholder("Add a new task...").fill("Task to Complete");
			await page.getByRole("button", { name: "Add Task" }).click();

			await page.waitForTimeout(500);

			// Find and click the complete button (○)
			const completeButton = page
				.locator('button[aria-label="Mark as complete"]')
				.first();
			await expect(completeButton).toBeVisible({ timeout: 3000 });
			await completeButton.click();

			// Statistics should update
			await expect(page.getByText("Done").locator("..")).toContainText("1", {
				timeout: 2000,
			});

			// Click the undo button (✓)
			const undoButton = page
				.locator('button[aria-label="Mark as incomplete"]')
				.first();
			await expect(undoButton).toBeVisible({ timeout: 2000 });
			await undoButton.click();

			// Should revert
			await expect(page.getByText("Pending").locator("..")).toContainText("1", {
				timeout: 2000,
			});
		});

		test("should support bulk selection and operations", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Add multiple tasks
			for (let i = 1; i <= 3; i++) {
				await page.getByPlaceholder("Add a new task...").fill(`Task ${i}`);
				await page.getByRole("button", { name: "Add Task" }).click();
				await page.waitForTimeout(200);
			}

			// Select all
			await page.getByRole("button", { name: "Select All" }).click();

			// Bulk complete
			const bulkCompleteButton = page.getByRole("button", {
				name: /Complete \(\d+\)/,
			});
			await expect(bulkCompleteButton).toBeVisible({ timeout: 2000 });
			await bulkCompleteButton.click();

			// All should be completed
			await expect(page.getByText("Done").locator("..")).toContainText("3", {
				timeout: 2000,
			});
		});

		test("should support soft delete and restore", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Task to Delete");
			await page.getByTestId("add-task-button").click();

			// Wait for task to appear
			const taskItem = page.locator("[data-testid^='todo-item-']").first();
			await expect(taskItem).toBeVisible({ timeout: 3000 });

			// Delete the task (soft delete)
			const deleteButton = page
				.locator("[data-testid^='todo-delete-']")
				.first();
			await expect(deleteButton).toBeVisible({ timeout: 3000 });
			await deleteButton.click();

			// Give time for the update to propagate
			await page.waitForTimeout(500);

			// Task should disappear - empty state should show
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});

			// Show deleted
			await page.getByTestId("toggle-deleted").click();

			// Wait for deleted items to appear
			await page.waitForTimeout(300);

			// Task should reappear
			await expect(taskItem).toBeVisible({ timeout: 3000 });

			// Restore button should be visible
			await expect(deleteButton).toBeVisible();
			await expect(deleteButton).toHaveText("Restore");
		});

		test("should handle concurrent operations", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Rapidly add multiple tasks
			for (let i = 1; i <= 5; i++) {
				await page
					.getByPlaceholder("Add a new task...")
					.fill(`Concurrent Task ${i}`);
				await page.getByRole("button", { name: "Add Task" }).click();
				// No wait - maximize concurrency
			}

			// All tasks should appear
			await expect(page.getByText("Total").locator("..")).toContainText("5", {
				timeout: 5000,
			});
		});

		test("should persist data across page reloads", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Add tasks
			await page.getByTestId("todo-input").fill("Persistent Task");
			await page.getByTestId("add-task-button").click();

			// Wait for task to appear
			const taskTitle = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskTitle).toBeVisible({ timeout: 3000 });
			await expect(taskTitle).toHaveValue("Persistent Task");

			// Wait a bit for persistence
			await page.waitForTimeout(1000);

			// Complete it
			const completeButton = page
				.locator("[data-testid^='todo-complete-']")
				.first();
			await expect(completeButton).toBeVisible({ timeout: 3000 });
			await completeButton.click();

			// Wait for completion to persist
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 3000,
			});
			await page.waitForTimeout(1500);

			// Reload
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Give time for data to load from database
			await page.waitForTimeout(1000);

			// Task should still exist and be completed
			await expect(taskTitle).toBeVisible({ timeout: 5000 });
			await expect(taskTitle).toHaveValue("Persistent Task");
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 3000,
			});
		});

		test("should handle bulk delete with mixed states", async ({ page }) => {
			await page.goto(config.url);
			await page.waitForLoadState("networkidle");

			// Add tasks
			for (let i = 1; i <= 3; i++) {
				await page.getByTestId("todo-input").fill(`Task ${i}`);
				await page.getByTestId("add-task-button").click();
				await page.waitForTimeout(200);
			}

			// Wait for all tasks to appear
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});

			// Select all and delete (soft delete)
			const selectAllButton = page.getByTestId("select-all");
			await expect(selectAllButton).toBeVisible({ timeout: 3000 });
			await selectAllButton.click();
			await page.waitForTimeout(100);

			const bulkDeleteButton = page.getByTestId("bulk-delete");
			await expect(bulkDeleteButton).toBeVisible({ timeout: 3000 });
			await bulkDeleteButton.click();

			// Wait for soft delete to process
			await page.waitForTimeout(1000);

			// All tasks should be soft deleted (count should be 0)
			await expect(page.getByTestId("count-total")).toHaveText("0", {
				timeout: 3000,
			});

			// Buttons should disappear since no todos are visible
			await expect(selectAllButton).not.toBeVisible({ timeout: 2000 });

			// Show deleted
			await page.getByTestId("toggle-deleted").click();

			// Wait for deleted items to fully render
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});
			await expect(page.getByTestId("todo-list")).toBeVisible({
				timeout: 3000,
			});

			// Wait for Select All button to appear (it only shows when todos.length > 0)
			await expect(selectAllButton).toBeVisible({ timeout: 3000 });

			// Extra wait to ensure todos are fully rendered and selectable
			await page.waitForTimeout(500);

			// Check if button says "Deselect All" (items might still be selected from before)
			const buttonText = await selectAllButton.textContent();
			if (buttonText === "Deselect All") {
				// Items are already selected, bulk delete button should already be visible
				const secondBulkDeleteButton = page.getByTestId("bulk-delete");
				await expect(secondBulkDeleteButton).toBeVisible({ timeout: 3000 });
				await secondBulkDeleteButton.click();
			} else {
				// Need to select all first
				await selectAllButton.click();
				await page.waitForTimeout(300);

				const secondBulkDeleteButton = page.getByTestId("bulk-delete");
				await expect(secondBulkDeleteButton).toBeVisible({ timeout: 3000 });
				await secondBulkDeleteButton.click();
			}

			// Wait for hard delete to process
			await page.waitForTimeout(1000);

			// All tasks should be gone permanently
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});
		});
	});
}
