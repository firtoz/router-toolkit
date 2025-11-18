# @firtoz/drizzle-indexeddb

TanStack DB collections backed by IndexedDB with automatic migrations powered by Drizzle ORM snapshots. Build reactive, type-safe IndexedDB applications with the power of Drizzle's schema management.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

> **Note:** This package currently builds on top of Drizzle's SQLite integration (using `drizzle-orm/sqlite-core` types and snapshots) until Drizzle adds native IndexedDB support. The migration system reads Drizzle's SQLite snapshots and translates them into IndexedDB object stores and indexes.

## Installation

```bash
npm install @firtoz/drizzle-indexeddb @firtoz/drizzle-utils drizzle-orm @tanstack/db
```

## Features

- ⚡ **TanStack DB collections** - Reactive collections with type safety (primary feature)
- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🔍 **Query optimization** - Leverage IndexedDB indexes for fast queries
- 📦 **Soft deletes** - Built-in support for `deletedAt` column
- ⚛️ **React hooks** - Provider and hooks for easy React integration
- 🔄 **Snapshot-based migrations** - Use Drizzle's generated snapshots to migrate IndexedDB
- 📝 **Function-based migrations** - Write custom migration functions for complex changes

## Quick Start

### 1. Setup Drizzle Schema

```typescript
// schema.ts
import { syncableTable } from "@firtoz/drizzle-utils";
import { text, integer } from "drizzle-orm/sqlite-core";

export const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});
```

### 2. Generate Migrations

```bash
# Generate Drizzle snapshots
drizzle-kit generate
```

### 3. Migrate IndexedDB

```typescript
// db.ts
import { migrateIndexedDB } from "@firtoz/drizzle-indexeddb";
import journal from "./drizzle/meta/_journal.json";
import * as snapshots from "./drizzle/snapshots";

export const db = await migrateIndexedDB("my-app", {
  journal,
  snapshots,
}, true); // Enable debug logging
```

### 4. Use with React

```typescript
// App.tsx
import { DrizzleIndexedDBProvider, useIndexedDBCollection } from "@firtoz/drizzle-indexeddb";
import { createCollection } from "@tanstack/db";

function App() {
  return (
    <DrizzleIndexedDBProvider db={db} schema={schema}>
      <TodoList />
    </DrizzleIndexedDBProvider>
  );
}

function TodoList() {
  const collection = useIndexedDBCollection("todos");
  const [todos] = collection.useStore();
  
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

## TanStack DB Collections

The primary feature of this package: Create reactive, type-safe collections backed by IndexedDB.

### Basic Usage

Create reactive collections backed by IndexedDB:

```typescript
import { createCollection } from "@tanstack/db";
import { indexedDBCollectionOptions } from "@firtoz/drizzle-indexeddb";

const todosCollection = createCollection(
  indexedDBCollectionOptions({
    db,
    tableName: "todos",
    syncMode: "on-demand", // or "realtime"
  })
);

// Subscribe to changes
const unsubscribe = todosCollection.subscribe((todos) => {
  console.log("Todos updated:", todos);
});

// CRUD operations
await todosCollection.insert({
  title: "Buy milk",
  completed: false,
});

await todosCollection.update(todoId, {
  completed: true,
});

await todosCollection.delete(todoId); // Soft delete (sets deletedAt)

// Query with filters
const completedTodos = await todosCollection.find({
  where: { completed: true },
  orderBy: { createdAt: "desc" },
  limit: 10,
});
```

### Collection Options

```typescript
interface IndexedDBCollectionConfig {
  db: IDBDatabase;
  tableName: string;
  syncMode?: "on-demand" | "realtime";
  debug?: boolean;
}
```

### Supported Operations

- **Insert** - Add new records
- **Update** - Modify existing records
- **Delete** - Soft delete (sets `deletedAt`) or hard delete
- **Find** - Query with filters, sorting, pagination
- **Subscribe** - React to data changes

### Query Features

```typescript
// Filtering
collection.find({
  where: {
    completed: false,
    title: { contains: "urgent" },
    priority: { in: ["high", "critical"] },
    createdAt: { gt: yesterday },
  }
});

// Sorting
collection.find({
  orderBy: { createdAt: "desc" }
});

// Pagination
collection.find({
  limit: 10,
  offset: 20,
});

// Soft delete filtering (automatic)
// By default, records with deletedAt !== null are excluded
```

## Migration Methods

### Snapshot-Based Migration

Use Drizzle's snapshot files to automatically migrate your IndexedDB schema:

```typescript
import { migrateIndexedDB } from "@firtoz/drizzle-indexeddb";
import journal from "./drizzle/meta/_journal.json";
import * as snapshots from "./drizzle/snapshots";

const db = await migrateIndexedDB("my-app-db", {
  journal,
  snapshots,
}, true); // debug flag

console.log("Database migrated successfully!");
```

**Features:**
- Automatically creates/updates object stores
- Manages indexes based on Drizzle schema
- Handles table deletion
- Tracks applied migrations
- Validates primary key changes
- Incremental migrations (only applies pending changes)

**Migration Tracking:**

Migrations are tracked in the `__drizzle_migrations` object store:

```typescript
interface MigrationRecord {
  id: number;        // Migration index
  tag: string;       // Migration name
  when: number;      // Migration timestamp
  appliedAt: number; // When it was applied
}
```

### Function-Based Migration

For complex migrations that require custom logic:

```typescript
import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";

const migrations = [
  // Migration 0: Initial schema
  async (db: IDBDatabase, transaction: IDBTransaction) => {
    const store = db.createObjectStore("todos", { keyPath: "id" });
    store.createIndex("title", "title", { unique: false });
  },
  
  // Migration 1: Add completed index
  async (db: IDBDatabase, transaction: IDBTransaction) => {
    const store = transaction.objectStore("todos");
    store.createIndex("completed", "completed", { unique: false });
  },
  
  // Migration 2: Transform data
  async (db: IDBDatabase, transaction: IDBTransaction) => {
    const store = transaction.objectStore("todos");
    const todos = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    // Transform data
    for (const todo of todos) {
      todo.priority = todo.priority || "medium";
      store.put(todo);
    }
  },
];

const db = await migrateIndexedDBWithFunctions("my-app-db", migrations, true);
```

## React Integration

### DrizzleIndexedDBProvider

Wrap your app with the provider:

```typescript
import { DrizzleIndexedDBProvider } from "@firtoz/drizzle-indexeddb";

function App() {
  return (
    <DrizzleIndexedDBProvider db={db} schema={schema}>
      <YourApp />
    </DrizzleIndexedDBProvider>
  );
}
```

### useDrizzleIndexedDB

Access the context:

```typescript
import { useDrizzleIndexedDB } from "@firtoz/drizzle-indexeddb";

function MyComponent() {
  const { getCollection } = useDrizzleIndexedDB();
  
  const todosCollection = getCollection("todos");
  const usersCollection = getCollection("users");
  
  // Use collections...
}
```

**Features:**
- Collection caching (same collection instance for same table)
- Reference counting for memory management
- Type-safe collection access

### useIndexedDBCollection

Hook for a specific collection:

```typescript
import { useIndexedDBCollection } from "@firtoz/drizzle-indexeddb";

function TodoList() {
  const collection = useIndexedDBCollection("todos");
  
  // Automatic ref counting and cleanup
  useEffect(() => {
    return () => {
      // Collection automatically cleaned up when component unmounts
    };
  }, []);
  
  // Use collection...
}
```

## Utilities

### deleteIndexedDB

Completely delete an IndexedDB database:

```typescript
import { deleteIndexedDB } from "@firtoz/drizzle-indexeddb";

await deleteIndexedDB("my-app-db");
console.log("Database deleted!");
```

Useful for:
- Resetting the database during development
- Clearing user data on logout
- Testing scenarios

## Advanced Usage

### Custom Sync Configuration

```typescript
import { indexedDBCollectionOptions } from "@firtoz/drizzle-indexeddb";

const collection = createCollection(
  indexedDBCollectionOptions({
    db,
    tableName: "todos",
    syncMode: "realtime", // Subscribe to changes automatically
    debug: true, // Enable debug logging
  })
);
```

### Handling Migration Errors

```typescript
try {
  const db = await migrateIndexedDB("my-app", config, true);
} catch (error) {
  console.error("Migration failed:", error);
  
  // Option 1: Delete and start fresh
  await deleteIndexedDB("my-app");
  const db = await migrateIndexedDB("my-app", config, true);
  
  // Option 2: Handle specific errors
  if (error.message.includes("Primary key structure changed")) {
    // Guide user to export data, delete DB, and reimport
  }
}
```

### Performance Optimization

```typescript
// Enable debug mode to see performance metrics
const db = await migrateIndexedDB("my-app", config, true);

// Output shows:
// [PERF] IndexedDB snapshot migrator start for my-app
// [PERF] Latest applied migration index: 5 (checked 5 migrations)
// [PERF] Found 2 pending migrations to apply: ["add_priority", "add_category"]
// [PERF] Upgrade started: v5 → v7
// [PERF] Creating object store: categories
// [PERF] Creating index: name on categories
// [PERF] Migration 5 complete
// [PERF] Migration 6 complete
// [PERF] All 2 migrations applied successfully
// [PERF] Migrator complete - database ready
```

## Schema Changes

### Adding a Column

Just update your schema and regenerate:

```typescript
// Before
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
});

// After
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  priority: text("priority").notNull().default("medium"),
});
```

```bash
drizzle-kit generate
```

The migrator handles it automatically!

### Adding an Index

```typescript
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }),
}, (table) => [
  index("title_idx").on(table.title),
  index("completed_idx").on(table.completed),
]);
```

### Renaming a Column

Drizzle snapshots don't track renames directly, but you can:

1. Use function-based migrations to handle data transformation
2. Or: Add new column, copy data, delete old column (3 separate migrations)

### Deleting a Table

Remove from schema and regenerate - the migrator will delete the object store.

## Troubleshooting

### "Primary key structure changed" Error

This happens when you change the primary key of a table. IndexedDB doesn't support changing keyPath after creation.

**Solution:**
1. Export your data
2. Delete the database: `await deleteIndexedDB("my-app")`
3. Re-run migrations
4. Import your data

### Migrations Not Applying

- Check that journal and snapshots are correctly imported
- Verify the snapshot files exist in `drizzle/snapshots/`
- Enable debug mode to see what's happening
- Check browser DevTools → Application → IndexedDB

### Performance Issues

- Add indexes to frequently queried columns
- Use `syncMode: "on-demand"` for collections that don't need real-time updates
- Consider pagination for large datasets
- Use `deletedAt` soft deletes instead of hard deletes for better performance

## License

MIT

## Author

Firtina Ozbalikchi <firtoz@github.com>

