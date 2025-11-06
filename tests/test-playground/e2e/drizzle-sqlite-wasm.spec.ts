import { expect, test } from "@playwright/test";

/**
 * E2E tests for @firtoz/drizzle-sqlite-wasm
 *
 * These tests verify that the drizzle-sqlite-wasm package works correctly:
 * - DrizzleProvider: SQLite WASM initialization with schema and migrations
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

test.describe("@firtoz/drizzle-sqlite-wasm - DrizzleProvider & useCollection", () => {
	test("DrizzleProvider should initialize SQLite WASM database", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("drizzle-provider-init");
		// Ensure database doesn't exist before starting
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		// Should render the page title (proving DrizzleProvider rendered successfully)
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
		const todoCards = page.locator(".rounded-lg.shadow-md");

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

		// Should show as pending (yellow badge)
		const todoCard = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Todo to Complete" });
		await expect(todoCard.getByText("⏳ Pending")).toBeVisible();

		// Should have white/gray background (not completed)
		await expect(todoCard).not.toHaveClass(/border-green-300/);

		// CORE TEST: Click complete button - useLiveQuery should update UI
		const completeButton = todoCard.getByRole("button", {
			name: "✅ Complete",
		});
		await completeButton.click();

		// Should update to completed state (green badge)
		await expect(todoCard.getByText("✅ Completed")).toBeVisible({
			timeout: 2000,
		});

		// Should have green border (completed styling)
		await expect(todoCard).toHaveClass(/border-green-300/);

		// Button should change to "Undo"
		await expect(
			todoCard.getByRole("button", { name: "↩️ Undo" }),
		).toBeVisible();

		// CORE TEST 2: Toggle back to incomplete
		const undoButton = todoCard.getByRole("button", { name: "↩️ Undo" });
		await undoButton.click();

		// Should revert to pending state
		await expect(todoCard.getByText("⏳ Pending")).toBeVisible({
			timeout: 2000,
		});
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
		const todoCards = page.locator(".rounded-lg.shadow-md");

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
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Todo to Delete" });
		const deleteButton = todoToDelete
			.getByRole("button")
			.filter({ hasText: "🗑️" });
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
	test("SQLite WASM should persist data across page reloads", async ({
		page,
	}) => {
		const dbName = getUniqueDbName("data-persistence");
		await deleteDatabase(page, dbName);
		await page.goto(`/sqlite/sqlite-test/${dbName}`);
		await page.waitForLoadState("networkidle");

		const input = page.getByPlaceholder("What needs to be done?");
		const addButton = page.getByRole("button", { name: "+ Add" });
		const todoCards = page.locator(".rounded-lg.shadow-md");

		// Check initial count
		const initialCount = await todoCards.count();

		// Add some todos
		await input.fill("Persist Test 1");
		await addButton.click();
		await input.fill("Persist Test 2");
		await addButton.click();

		await expect(todoCards).toHaveCount(initialCount + 2, { timeout: 2000 });

		// Mark one as complete
		const firstTodo = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Persist Test 1" });
		await firstTodo.getByRole("button", { name: "✅ Complete" }).click();

		// Wait for completion to be visible
		await expect(firstTodo.getByText("✅ Completed")).toBeVisible();

		// CORE TEST: Reload the page - data should persist
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Both todos should be visible with correct data
		await expect(page.getByText("Persist Test 1")).toBeVisible();
		await expect(page.getByText("Persist Test 2")).toBeVisible();

		// First todo should still be marked as completed
		const reloadedFirstTodo = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Persist Test 1" });
		await expect(reloadedFirstTodo.getByText("✅ Completed")).toBeVisible();

		// Second todo should still be pending
		const reloadedSecondTodo = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Persist Test 2" });
		await expect(reloadedSecondTodo.getByText("⏳ Pending")).toBeVisible();
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
		const todoCards = page.locator(".rounded-lg.shadow-md");

		// Check initial count
		const initialCount = await todoCards.count();

		// Add 5 todos
		for (let i = 1; i <= 5; i++) {
			await input.fill(`Complex Todo ${i}`);
			await addButton.click();
		}

		await expect(todoCards).toHaveCount(initialCount + 5, { timeout: 2000 });

		// Complete todos 1, 3, and 5
		for (const num of [1, 3, 5]) {
			const todo = page
				.locator(".rounded-lg.shadow-md")
				.filter({ hasText: `Complex Todo ${num}` });
			await todo.getByRole("button", { name: "✅ Complete" }).click();
			await expect(todo.getByText("✅ Completed")).toBeVisible();
		}

		// Delete todo 2
		const todoToDelete = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Complex Todo 2" });
		await todoToDelete.getByRole("button").filter({ hasText: "🗑️" }).click();
		await expect(todoCards).toHaveCount(initialCount + 4, { timeout: 2000 });

		// CORE TEST: Reload and verify complex state persisted
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Todos 1, 3, 5 should be completed
		for (const num of [1, 3, 5]) {
			const todo = page
				.locator(".rounded-lg.shadow-md")
				.filter({ hasText: `Complex Todo ${num}` });
			await expect(todo.getByText("✅ Completed")).toBeVisible();
		}

		// Todo 4 should be pending
		const todo4 = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Complex Todo 4" });
		await expect(todo4.getByText("⏳ Pending")).toBeVisible();

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
		const todoCards = page.locator(".rounded-lg.shadow-md");

		// Check initial count
		const initialCount = await todoCards.count();

		// Add todos in sequence with small delays
		const todos = ["First", "Second", "Third"];
		for (const todo of todos) {
			await input.fill(todo);
			await addButton.click();
			await page.waitForTimeout(100); // Ensure different timestamps
		}

		await expect(todoCards).toHaveCount(initialCount + 3, { timeout: 2000 });

		// Check order of OUR todos by examining cards that contain our text
		// They should appear in insertion order (oldest first due to createdAt asc)
		const ourTodos = todoCards.filter({
			hasText: /^(First|Second|Third|Fourth)$/,
		});
		await expect(ourTodos.nth(0)).toContainText("First");
		await expect(ourTodos.nth(1)).toContainText("Second");
		await expect(ourTodos.nth(2)).toContainText("Third");

		// Add a new todo - should appear at the end of our sequence
		await input.fill("Fourth");
		await addButton.click();

		await expect(todoCards).toHaveCount(initialCount + 4, { timeout: 2000 });
		await expect(ourTodos.nth(3)).toContainText("Fourth");
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

		const todoCard = page
			.locator(".rounded-lg.shadow-md")
			.filter({ hasText: "Schema Test Todo" });

		// CORE TEST: Verify all schema fields are present
		// Title
		await expect(todoCard.getByRole("heading")).toHaveText("Schema Test Todo");

		// ID (UUID format)
		const idText = await todoCard.getByText(/ID:/).textContent();
		expect(idText).toMatch(/ID:/);

		// Check UUID format in the code element
		const codeElement = todoCard.locator("code");
		const uuid = await codeElement.textContent();
		expect(uuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);

		// Completed status (should default to false - Pending)
		await expect(todoCard.getByText("⏳ Pending")).toBeVisible();

		// Timestamps
		await expect(todoCard.getByText(/Created:/)).toBeVisible();
		await expect(todoCard.getByText(/Updated:/)).toBeVisible();
	});
});
