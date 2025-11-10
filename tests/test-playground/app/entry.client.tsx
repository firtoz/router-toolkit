import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { initializeSqliteWorker } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";

// Initialize SQLite worker ASAP - it will start loading WASM in parallel with React hydration
performance.mark("app-entry-client-start");
console.log("[PERF] Entry client start - initializing SQLite worker");
initializeSqliteWorker(SqliteWorker);

startTransition(() => {
	hydrateRoot(document, <HydratedRouter />);
});
