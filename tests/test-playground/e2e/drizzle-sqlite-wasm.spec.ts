import { expect, test } from "@playwright/test";

/**
 * E2E tests for @firtoz/drizzle-sqlite-wasm
 *
 * These tests verify that the drizzle-sqlite-wasm package works correctly:
 * - DrizzleSqliteProvider: SQLite WASM initialization with schema and migrations
 * - useCollection: Type-safe collection access with Drizzle schema
 * - useLiveQuery: Real-time reactive queries with automatic updates
 * - Collection operations: insert, update, delete with persistence
 *
 * Each test uses a unique database name to enable parallel execution
 */

// Clear all OPFS storage before running any tests
test.beforeAll(async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto("/");

	// Clear all OPFS storage
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

	await context.close();
});

// Helper to generate unique database name for each test
function getUniqueDbName(testName: string) {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `test-${testName.replace(/\s+/g, "-").toLowerCase()}-${timestamp}-${random}`;
}

// Helper to delete a specific database file from OPFS
async function deleteDatabase(page: any, dbName: string) {
	// Navigate to home page first to get access to navigator.storage
	await page.goto("/");
	await page.evaluate(async (dbFileName: string) => {
		try {
			const root = await navigator.storage.getDirectory();
			try {
				// Delete the database file (worker adds .sqlite3 extension)
				await root.removeEntry(`${dbFileName}.db.sqlite3`, {
					recursive: false,
				});
				console.log(`Deleted database: ${dbFileName}.db.sqlite3`);
			} catch (e) {
				// File might not exist, which is fine
				console.log(
					`Database ${dbFileName}.db.sqlite3 doesn't exist or couldn't be deleted:`,
					e,
				);
			}
		} catch (e) {
			console.log("Failed to access OPFS:", e);
		}
	}, dbName);
}

test.describe("@firtoz/drizzle-sqlite-wasm - DrizzleSqliteProvider & useCollection", () => {
	test("DrizzleSqliteProvider should initialize SQLite WASM database", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("drizzle-provider-init");
		// Ensure database doesn't exist before starting
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		// Should render the page title (proving DrizzleSqliteProvider rendered successfully)
		await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();

		// Should render the input form (proving useCollection hook is working)
		await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible();
		await expect(page.getByRole("button", { name: "+ Add" })).toBeVisible();
	});

	test("useCollection should provide type-safe collection access", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("use-collection-access");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		// CORE TEST: useCollection allows inserting data
		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });

		await input.fill("Test Todo from useCollection");
		await addButton.click();

		// Should see the new todo rendered (proving collection insert worked)
		await expect(page.getByText("Test Todo from useCollection")).toBeVisible();

		// Should see todo metadata (ID, timestamps) proving type-safe schema
		await expect(page.getByText(/ID:/)).toBeVisible();
		await expect(page.getByText(/Created:/)).toBeVisible();
		await expect(page.getByText(/Updated:/)).toBeVisible();
	});
});

test.describe("@firtoz/drizzle-sqlite-wasm - useLiveQuery Real-time Updates", () => {
	test("useLiveQuery should reactively update on insert", async ({ page }) => {
		const dbName = getUniqueDbName("live-query-insert");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });
		const todoCards = page.getByTestId(/^todo-card-/);

		// Check initial count (may not be zero due to database sharing)
		const initialCount = await todoCards.count();

		// CORE TEST 1: Add first todo - useLiveQuery should update automatically
		await input.fill("First Live Query Test");
		await addButton.click();

		await expect(todoCards).toHaveCount(initialCount + 1, { timeout: 2000 });
		await expect(page.getByText("First Live Query Test")).toBeVisible();

		// CORE TEST 2: Add second todo - useLiveQuery should update again
		await input.fill("Second Live Query Test");
		await addButton.click();

		await expect(todoCards).toHaveCount(initialCount + 2, { timeout: 2000 });
		await expect(page.getByText("Second Live Query Test")).toBeVisible();

		// CORE TEST 3: Add third todo - verify reactive updates continue working
		await input.fill("Third Live Query Test");
		await addButton.click();

		await expect(todoCards).toHaveCount(initialCount + 3, { timeout: 2000 });
		await expect(page.getByText("Third Live Query Test")).toBeVisible();
	});

	test("useLiveQuery should reactively update on update (toggle complete)", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("live-query-update");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });

		// Add a todo
		await input.fill("Todo to Complete");
		await addButton.click();

		// Wait for the todo to be created and get its ID
		await expect(page.getByText("Todo to Complete")).toBeVisible({
			timeout: 2000,
		});

		// Get the todo card by filtering test IDs that contain the title
		const todoCard = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Todo to Complete" });
		await expect(todoCard.getByTestId(/^todo-status-/)).toHaveText(
			"⏳ Pending",
		);

		// CORE TEST: Click complete button - useLiveQuery should update UI
		const completeButton = todoCard.getByRole("button", {
			name: "✅ Complete",
		});
		await completeButton.click();

		// Should update to completed state (green badge)
		await expect(todoCard.getByTestId(/^todo-status-/)).toHaveText(
			"✅ Completed",
			{
				timeout: 2000,
			},
		);

		// Button should change to "Undo"
		await expect(
			todoCard.getByRole("button", { name: "↩️ Undo" }),
		).toBeVisible();

		// Wait for DOM to stabilize after state change
		await page.waitForTimeout(200);

		// CORE TEST 2: Toggle back to incomplete
		// Re-query to avoid stale element reference
		await todoCard.getByRole("button", { name: "↩️ Undo" }).click();

		// Should revert to pending state
		await expect(todoCard.getByTestId(/^todo-status-/)).toHaveText(
			"⏳ Pending",
			{
				timeout: 2000,
			},
		);
		await expect(
			todoCard.getByRole("button", { name: "✅ Complete" }),
		).toBeVisible();
	});

	test("useLiveQuery should reactively update on delete", async ({ page }) => {
		const dbName = getUniqueDbName("live-query-delete");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });
		const todoCards = page.getByTestId(/^todo-card-/);

		// Check initial count (may not be zero due to OPFS persistence from previous runs)
		const initialCount = await todoCards.count();

		// Add multiple todos
		await input.fill("Todo to Keep");
		await addButton.click();
		await input.fill("Todo to Delete");
		await addButton.click();

		await expect(todoCards).toHaveCount(initialCount + 2, { timeout: 2000 });

		// CORE TEST: Delete the second todo - useLiveQuery should update
		const todoToDelete = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Todo to Delete" });
		const deleteButton = todoToDelete.getByTestId(/^todo-delete-/);
		await deleteButton.click();

		// Should have one less todo
		await expect(todoCards).toHaveCount(initialCount + 1, { timeout: 2000 });

		// Deleted todo should not be visible
		await expect(page.getByText("Todo to Delete")).not.toBeVisible();

		// Kept todo should still be visible
		await expect(page.getByText("Todo to Keep")).toBeVisible();
	});
});

test.describe("@firtoz/drizzle-sqlite-wasm - Data Persistence", () => {
	// Run persistence tests serially to avoid OPFS contention
	test.describe.configure({ mode: "serial" });

	test("SQLite WASM should persist data across page reloads", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("data-persistence");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });
		const todoCards = page.getByTestId(/^todo-card-/);

		// Check initial count
		const initialCount = await todoCards.count();

		// Add some todos
		await input.fill("Persist Test 1");
		await addButton.click();
		await expect(todoCards).toHaveCount(initialCount + 1, { timeout: 2000 });

		await input.fill("Persist Test 2");
		await addButton.click();
		await expect(todoCards).toHaveCount(initialCount + 2, { timeout: 2000 });

		// Mark one as complete
		const firstTodo = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Persist Test 1" });
		await firstTodo.getByRole("button", { name: "✅ Complete" }).click();

		// Wait for completion to be visible
		await expect(firstTodo.getByTestId(/^todo-status-/)).toHaveText(
			"✅ Completed",
		);

		// Give SQLite WASM time to persist all operations
		await page.waitForTimeout(1500);

		// CORE TEST: Reload the page - data should persist
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Both todos should be visible with correct data
		await expect(page.getByText("Persist Test 1")).toBeVisible();
		await expect(page.getByText("Persist Test 2")).toBeVisible();

		// First todo should still be marked as completed
		const reloadedFirstTodo = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Persist Test 1" });
		await expect(reloadedFirstTodo.getByTestId(/^todo-status-/)).toHaveText(
			"✅ Completed",
		);

		// Second todo should still be pending
		const reloadedSecondTodo = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Persist Test 2" });
		await expect(reloadedSecondTodo.getByTestId(/^todo-status-/)).toHaveText(
			"⏳ Pending",
		);
	});

	test("SQLite WASM should handle complex operations with persistence", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("complex-persistence");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });
		const todoCards = page.getByTestId(/^todo-card-/);

		// Check initial count
		const initialCount = await todoCards.count();

		// Add 5 todos
		for (let i = 1; i <= 5; i++) {
			await input.fill(`Complex Todo ${i}`);
			await addButton.click();
			// Wait for each todo to appear before adding the next
			await expect(todoCards).toHaveCount(initialCount + i, { timeout: 2000 });
		}

		// Complete todos 1, 3, and 5
		for (const num of [1, 3, 5]) {
			// Re-query todo to avoid stale element references
			const todo = page
				.getByTestId(/^todo-card-/)
				.filter({ hasText: `Complex Todo ${num}` });

			// Wait for the button to be visible and stable
			const completeButton = todo.getByRole("button", { name: "✅ Complete" });
			await expect(completeButton).toBeVisible({ timeout: 5000 });
			await completeButton.click({ timeout: 5000 });

			await expect(todo.getByTestId(/^todo-status-/)).toHaveText(
				"✅ Completed",
			);
			// Let DOM stabilize after each toggle
			await page.waitForTimeout(200);
		}

		// Give SQLite WASM time to persist the complete operations
		await page.waitForTimeout(1000);

		// Delete todo 2
		const todoToDelete = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Complex Todo 2" });
		await todoToDelete.getByTestId(/^todo-delete-/).click();
		await expect(todoCards).toHaveCount(initialCount + 4, { timeout: 2000 });

		// Verify deletion is visible immediately
		await expect(page.getByText("Complex Todo 2")).not.toBeVisible();

		// Give SQLite WASM time to persist the delete operation
		await page.waitForTimeout(500);

		// CORE TEST: Reload and verify complex state persisted
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Todos 1, 3, 5 should be completed
		for (const num of [1, 3, 5]) {
			const todo = page
				.getByTestId(/^todo-card-/)
				.filter({ hasText: `Complex Todo ${num}` });
			await expect(todo.getByTestId(/^todo-status-/)).toHaveText(
				"✅ Completed",
			);
		}

		// Todo 4 should be pending
		const todo4 = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Complex Todo 4" });
		await expect(todo4.getByTestId(/^todo-status-/)).toHaveText("⏳ Pending");

		// Todo 2 should not exist
		await expect(page.getByText("Complex Todo 2")).not.toBeVisible();
	});
});

test.describe("@firtoz/drizzle-sqlite-wasm - Query Ordering", () => {
	test("useLiveQuery should maintain orderBy clause (createdAt asc)", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("query-ordering");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });
		const todoCards = page.getByTestId(/^todo-card-/);

		// Check initial count
		const initialCount = await todoCards.count();

		// Add todos one at a time with delays to ensure distinct timestamps
		const todos = ["First", "Second", "Third"];
		for (let i = 0; i < todos.length; i++) {
			await input.fill(todos[i]);
			await addButton.click();

			// Wait for the new todo to appear
			await expect(todoCards).toHaveCount(initialCount + i + 1, {
				timeout: 2000,
			});
			await expect(todoCards.filter({ hasText: todos[i] })).toHaveCount(1, {
				timeout: 2000,
			});

			// Add significant delay after each insert to ensure different timestamps
			// Need at least 1 second to ensure distinct createdAt values
			if (i < todos.length - 1) {
				await page.waitForTimeout(1100);
			}
		}

		// Verify final count
		await expect(todoCards).toHaveCount(initialCount + 3);

		// Wait for the reactive query to stabilize and apply ordering
		await page.waitForTimeout(500);

		// Check visual order - todos should appear in the order they were created
		// because of orderBy(asc(table.createdAt))
		const getIndex = async (text: string) => {
			return await todoCards.evaluateAll((cards, searchText) => {
				return cards.findIndex((card) =>
					card.textContent?.includes(searchText),
				);
			}, text);
		};

		const firstIdx = await getIndex("First");
		const secondIdx = await getIndex("Second");
		const thirdIdx = await getIndex("Third");

		// Verify they appear in the correct order (First < Second < Third)
		expect(firstIdx).toBeGreaterThanOrEqual(0);
		expect(firstIdx).toBeLessThan(secondIdx);
		expect(secondIdx).toBeLessThan(thirdIdx);

		// Add a new todo - should appear at the end
		await page.waitForTimeout(1100); // Delay to ensure different timestamp
		await input.fill("Fourth");
		await addButton.click();

		// Wait for it to appear
		await expect(todoCards).toHaveCount(initialCount + 4, { timeout: 2000 });
		await expect(todoCards.filter({ hasText: "Fourth" })).toHaveCount(1, {
			timeout: 2000,
		});

		const fourthIdx = await getIndex("Fourth");

		// Fourth should appear after Third (orderBy createdAt asc)
		expect(thirdIdx).toBeLessThan(fourthIdx);
	});
});

test.describe("@firtoz/drizzle-sqlite-wasm - Schema Type Safety", () => {
	test("Collection should enforce schema structure (id, title, completed, timestamps)", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("schema-type-safety");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });

		await input.fill("Schema Test Todo");
		await addButton.click();

		// Wait for the todo to be created
		await expect(page.getByText("Schema Test Todo")).toBeVisible({
			timeout: 2000,
		});

		const todoCard = page
			.getByTestId(/^todo-card-/)
			.filter({ hasText: "Schema Test Todo" });

		// CORE TEST: Verify all schema fields are present
		// Title
		await expect(todoCard.getByTestId(/^todo-title-/)).toHaveText(
			"Schema Test Todo",
		);

		// ID (UUID format)
		const uuid = await todoCard.getByTestId(/^todo-id-/).textContent();
		expect(uuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);

		// Completed status (should default to false - Pending)
		await expect(todoCard.getByTestId(/^todo-status-/)).toHaveText(
			"⏳ Pending",
		);

		// Timestamps
		await expect(todoCard.getByTestId(/^todo-created-/)).toBeVisible();
		await expect(todoCard.getByTestId(/^todo-updated-/)).toBeVisible();
	});
});
