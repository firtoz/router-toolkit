---
"@firtoz/drizzle-sqlite-wasm": minor
---

Initial release of `@firtoz/drizzle-sqlite-wasm` - TanStack DB collections backed by SQLite WASM running in Web Workers, with full Drizzle ORM integration.

## Features

### TanStack DB Collections (Primary Feature)

**`drizzleCollectionOptions(config)`** - The main feature: Create reactive TanStack DB collections backed by SQLite WASM:

- Type-safe CRUD operations
- Reactive subscriptions to data changes
- Soft delete support
- Query optimization with SQLite indexes
- Pagination and sorting
- Non-blocking operations via Web Workers

**IndexedDB fallback** - Re-exports `indexedDBCollectionOptions` from `@firtoz/drizzle-indexeddb`:

- Seamless integration between SQLite and IndexedDB
- Use IndexedDB for offline-first sync layer
- Consistent API across both storage backends

### Worker-Based SQLite

**`SqliteWorkerClient`** - Type-safe Web Worker client for SQLite operations:

- Runs SQLite database in a dedicated Web Worker for non-blocking UI
- Built on `@firtoz/worker-helper` for type safety and validation
- Automatic connection lifecycle management
- Performance monitoring and diagnostics
- Supports multiple database instances

**`SqliteWorkerManager`** - Manages multiple SQLite databases in a single worker:

- Efficient resource utilization with shared worker
- Database instance caching and lifecycle management
- Automatic migration handling
- Global manager for singleton worker access

**`initializeSqliteWorker()`** - Initialize the global SQLite worker:

- Accepts any Worker constructor for bundler compatibility
- Debug mode for performance tracking
- Returns manager for manual control

### Drizzle Integration

**`drizzleSqliteWasmWorker(client, config, debug?)`** - Create Drizzle instance backed by worker:

- Full Drizzle ORM API with type safety
- Async query execution via Worker
- Automatic serialization/deserialization

**`drizzleSqliteWasm(sqliteDb, config, debug?)`** - Direct Drizzle instance (non-worker):

- Use SQLite WASM directly in main thread
- Same Drizzle ORM API
- Ideal for testing or synchronous contexts

### Migrations

**`customSqliteMigrate(config)`** - Custom SQLite migration system:

- Compatible with Drizzle snapshots
- Handles SQL migrations
- Tracks applied migrations
- Journal-based migration history

### React Integration

**`DrizzleSqliteProvider`** - React context provider:

- Manages worker lifecycle
- Automatic database initialization
- Collection caching with ref counting
- Type-safe context

**`useDrizzle(Worker, dbName, schema, migrations)`** - React hook for SQLite:

- Automatic worker management
- Migration handling
- Ready promise for initialization tracking
- Bundler-agnostic Worker support

**`useDrizzleContext()`** - Access Drizzle SQLite context:

- Get Drizzle instance
- Access collections with type safety

**`useCollection(tableName)`** - Hook for specific collections:

- Automatic ref counting
- Type-safe collection access

### Performance Utilities

Built-in performance monitoring tools:

- `getPerformanceMetrics()` - Get detailed timing metrics
- `getPerformanceMarks()` - Access performance marks
- `logPerformanceMetrics()` - Log performance data
- `exportPerformanceData()` - Export metrics for analysis
- `clearPerformanceData()` - Clear performance history
- `createPerformanceObserver()` - Custom performance observers

### Type Utilities

Re-exports from `@firtoz/drizzle-utils`:

- `syncableTable` - Create tables with timestamp tracking
- `makeId` - Type-safe ID creation
- `IdOf`, `TableId`, `Branded`, `IdType` - Type utilities
- `SelectSchema`, `InsertSchema` - Schema helpers

## Bundler Support

Works with all major bundlers:

**Vite:**
```typescript
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
```

**Webpack 5+:**
```typescript
const SqliteWorker = class extends Worker {
  constructor() {
    super(
      new URL("@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker", import.meta.url),
      { type: "module" }
    );
  }
};
const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
```

**Parcel 2+:**
```typescript
const SqliteWorker = class extends Worker {
  constructor() {
    super(
      new URL("@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker", import.meta.url)
    );
  }
};
const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
```

## Example

```typescript
import { DrizzleSqliteProvider, useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "./schema";
import migrations from "./migrations";

function App() {
  return (
    <DrizzleSqliteProvider
      worker={SqliteWorker}
      dbName="my-app-db"
      schema={schema}
      migrations={migrations}
    >
      <TodoList />
    </DrizzleSqliteProvider>
  );
}

function TodoList() {
  const { drizzle } = useDrizzle(SqliteWorker, "my-app-db", schema, migrations);
  
  // Use Drizzle ORM
  const todos = await drizzle.select().from(schema.todoTable);
  
  // Or use TanStack DB collections
  const collection = useCollection("todos");
}
```

## Dependencies

- `@firtoz/drizzle-indexeddb` (workspace)
- `@firtoz/drizzle-utils` (workspace)
- `@firtoz/maybe-error` (workspace)
- `@firtoz/worker-helper` (workspace)
- `@sqlite.org/sqlite-wasm`
- `drizzle-orm`
- `drizzle-valibot`
- `@tanstack/db`
- `react`
- `zod`

