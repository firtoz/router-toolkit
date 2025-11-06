# useDrizzle Hook - Cross-Bundler Support

The `useDrizzle` hook provides a React hook for using SQLite with Drizzle ORM in a Web Worker. It's designed to work with any bundler by accepting a Worker constructor.

## Usage

### Basic Signature

```typescript
const { drizzle } = useDrizzle(
  WorkerConstructor: new () => Worker
  dbName: string,
  schema: TSchema,
  migrations: DurableSqliteMigrationConfig,
);
```

## Bundler-Specific Examples

### Vite

Vite has special `?worker` suffix support for importing workers:

```typescript
import { useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "./schema";
import migrations from "./migrations";

function MyComponent() {
  const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
  
  // Use drizzle...
}
```

### Webpack 5+

Webpack 5+ supports workers via `new URL()` with `import.meta.url`. You'll need to wrap it in a constructor:

```typescript
import { useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import * as schema from "./schema";
import migrations from "./migrations";

// Create a Worker constructor that wraps the URL
const SqliteWorker = class extends Worker {
  constructor() {
    super(
      new URL("@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker", import.meta.url),
      { type: "module" }
    );
  }
};

function MyComponent() {
  const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
  
  // Use drizzle...
}
```

### Parcel

Parcel 2+ also supports the `new URL()` pattern:

```typescript
import { useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import * as schema from "./schema";
import migrations from "./migrations";

const SqliteWorker = class extends Worker {
  constructor() {
    super(
      new URL("@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker", import.meta.url),
      { type: "module" }
    );
  }
};

function MyComponent() {
  const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
  
  // Use drizzle...
}
```

### esbuild

With esbuild, you might need to configure worker loading or copy the worker file to your public directory:

```typescript
import { useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import * as schema from "./schema";
import migrations from "./migrations";

// Assuming you've copied the worker to your public directory
const SqliteWorker = class extends Worker {
  constructor() {
    super("/workers/sqlite.worker.js", { type: "module" });
  }
};

function MyComponent() {
  const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
  
  // Use drizzle...
}
```

### Rollup

With Rollup and `@rollup/plugin-url` or similar:

```typescript
import { useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import * as schema from "./schema";
import migrations from "./migrations";
import workerUrl from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?url";

const SqliteWorker = class extends Worker {
  constructor() {
    super(workerUrl, { type: "module" });
  }
};

function MyComponent() {
  const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
  
  // Use drizzle...
}
```

### Custom Worker Constructor

If your bundler requires a different approach, you can always create your own Worker constructor:

```typescript
import { useDrizzle } from "@firtoz/drizzle-sqlite-wasm";
import * as schema from "./schema";
import migrations from "./migrations";

// Create a custom Worker constructor
const SqliteWorker = class extends Worker {
  constructor() {
    // However your bundler/setup requires it
    super("/path/to/worker.js", { type: "module" });
  }
};

function MyComponent() {
  const { drizzle } = useDrizzle(SqliteWorker, "mydb", schema, migrations);
  
  // Use drizzle...
}
```

## Important Notes

1. **Worker Constructor**: Pass a Worker constructor (`new () => Worker`) that creates your SQLite worker instance.

2. **Module Workers**: The SQLite worker is an ES module, so make sure to use `{ type: "module" }` when creating workers.

3. **Cross-Origin Isolation**: For OPFS (persistent storage) support, your site needs to be cross-origin isolated with these headers:
   - `Cross-Origin-Embedder-Policy: require-corp`
   - `Cross-Origin-Opener-Policy: same-origin`

4. **Constructor Stability**: Define your Worker constructor outside the component or memoize it to prevent recreating the worker on every render.

## Troubleshooting

### Worker not loading

Make sure your bundler is configured to handle workers. Most modern bundlers support workers out of the box, but you may need to enable module worker support.

### OPFS not available

If you see "transient" storage warnings, check:
1. Your site is served over HTTPS (required for OPFS)
2. Cross-origin isolation headers are set correctly
3. Your browser supports OPFS (most modern browsers do)

### TypeScript errors

Make sure you have the worker type definitions installed:
```bash
npm install -D @types/web
```

