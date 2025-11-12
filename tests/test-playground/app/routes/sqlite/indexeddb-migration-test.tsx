import { useState, useEffect } from "react";
import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";

interface MigrationStatus {
	status: "idle" | "checking" | "migrating" | "success" | "error";
	message?: string;
	dbInfo?: {
		version: number;
		objectStores: string[];
		indexes: Record<string, string[]>;
		appliedMigrations: number[];
		pendingMigrations: number;
	};
}

export function meta() {
	return [
		{ title: "IndexedDB Migration Test" },
		{
			name: "description",
			content: "Test IndexedDB migrations with generated migration functions",
		},
	];
}

function IndexedDBMigrationContent() {
	const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
		status: "checking",
		message: "Checking database status...",
	});

	const checkDatabaseStatus = async () => {
		try {
			// Try to open the database to check its status
			const existingDb = await new Promise<IDBDatabase | null>((resolve) => {
				const request = indexedDB.open("test-migration-db");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => resolve(null); // DB doesn't exist
			});

			if (!existingDb) {
				setMigrationStatus({
					status: "idle",
					message: "Database not found. Ready to create.",
				});
				return;
			}

			// Check if database is empty (no object stores means newly created)
			if (existingDb.objectStoreNames.length === 0) {
				existingDb.close();
				// Delete the empty database that was just created
				await new Promise<void>((resolve, reject) => {
					const deleteRequest = indexedDB.deleteDatabase("test-migration-db");
					deleteRequest.onsuccess = () => resolve();
					deleteRequest.onerror = () => reject(deleteRequest.error);
				});
				setMigrationStatus({
					status: "idle",
					message: "Database not found. Ready to create.",
				});
				return;
			}

			// Check applied migrations
			const appliedMigrations: number[] = [];
			if (existingDb.objectStoreNames.contains("__drizzle_migrations")) {
				const transaction = existingDb.transaction(
					"__drizzle_migrations",
					"readonly",
				);
				const store = transaction.objectStore("__drizzle_migrations");
				const request = store.getAll();

				await new Promise<void>((resolve, reject) => {
					request.onsuccess = () => {
						const records = request.result as Array<{ id: number }>;
						appliedMigrations.push(...records.map((r) => r.id));
						resolve();
					};
					request.onerror = () => reject(request.error);
				});
			}

			// Gather database info
			const objectStores = Array.from(existingDb.objectStoreNames);
			const indexes: Record<string, string[]> = {};

			if (objectStores.length > 0) {
				const transaction = existingDb.transaction(objectStores, "readonly");
				for (const storeName of objectStores) {
					const store = transaction.objectStore(storeName);
					indexes[storeName] = Array.from(store.indexNames);
				}
			}

			const pendingCount = migrations.length - appliedMigrations.length;

			setMigrationStatus({
				status: "idle",
				message:
					pendingCount > 0
						? `${appliedMigrations.length} migrations applied, ${pendingCount} pending`
						: `All ${appliedMigrations.length} migrations applied`,
				dbInfo: {
					version: existingDb.version,
					objectStores,
					indexes,
					appliedMigrations: appliedMigrations.sort((a, b) => a - b),
					pendingMigrations: pendingCount,
				},
			});

			existingDb.close();
		} catch (error) {
			setMigrationStatus({
				status: "error",
				message: `Failed to check database: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	};

	useEffect(() => {
		checkDatabaseStatus();

		// Expose migrations on window for test purposes
		if (typeof window !== "undefined") {
			(
				window as unknown as { testMigrations?: typeof migrations }
			).testMigrations = migrations;
		}
	}, []);

	const runMigration = async () => {
		setMigrationStatus({
			status: "migrating",
			message: "Running migrations...",
		});

		try {
			const startTime = Date.now();

			const db = await migrateIndexedDBWithFunctions(
				"test-migration-db",
				migrations,
				true, // debug mode
			);

			const endTime = Date.now();

			// Check applied migrations
			const appliedMigrations: number[] = [];
			const migrationsTransaction = db.transaction(
				"__drizzle_migrations",
				"readonly",
			);
			const migrationsStore = migrationsTransaction.objectStore(
				"__drizzle_migrations",
			);
			const migrationsRequest = migrationsStore.getAll();

			await new Promise<void>((resolve, reject) => {
				migrationsRequest.onsuccess = () => {
					const records = migrationsRequest.result as Array<{ id: number }>;
					appliedMigrations.push(...records.map((r) => r.id));
					resolve();
				};
				migrationsRequest.onerror = () => reject(migrationsRequest.error);
			});

			// Gather database info
			const objectStores = Array.from(db.objectStoreNames);
			const indexes: Record<string, string[]> = {};

			// Read indexes for each object store
			const transaction = db.transaction(objectStores, "readonly");
			for (const storeName of objectStores) {
				const store = transaction.objectStore(storeName);
				indexes[storeName] = Array.from(store.indexNames);
			}

			const migrationsApplied =
				appliedMigrations.length -
				(migrationStatus.dbInfo?.appliedMigrations.length ?? 0);

			setMigrationStatus({
				status: "success",
				message:
					migrationsApplied > 0
						? `Successfully applied ${migrationsApplied} migration${migrationsApplied !== 1 ? "s" : ""} in ${endTime - startTime}ms!`
						: `No new migrations to apply. Database is up to date.`,
				dbInfo: {
					version: db.version,
					objectStores,
					indexes,
					appliedMigrations: appliedMigrations.sort((a, b) => a - b),
					pendingMigrations: 0,
				},
			});

			db.close();
		} catch (error) {
			setMigrationStatus({
				status: "error",
				message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	};

	const deleteMigration = async () => {
		try {
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase("test-migration-db");
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
			setMigrationStatus({
				status: "idle",
				message: "Database deleted. Ready to create.",
			});
		} catch (error) {
			setMigrationStatus({
				status: "error",
				message: `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<div className="max-w-4xl mx-auto py-8 px-4">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
						IndexedDB Migration Test
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Testing generated IndexedDB migration functions
					</p>
				</div>

				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
					{/* Migration Info */}
					<div className="space-y-2">
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
							Migration Status
						</h2>
						<div className="flex items-center gap-3 flex-wrap">
							<span
								className={`px-3 py-1 rounded-full text-sm font-medium ${
									migrationStatus.status === "idle"
										? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
										: migrationStatus.status === "checking"
											? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300"
											: migrationStatus.status === "migrating"
												? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
												: migrationStatus.status === "success"
													? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
													: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
								}`}
								data-testid="migration-status"
							>
								{migrationStatus.status}
							</span>
							<span
								className="text-sm text-gray-600 dark:text-gray-400"
								data-testid="total-migrations"
							>
								{migrations.length} total migrations
							</span>
							{migrationStatus.dbInfo && (
								<>
									<span
										className="text-sm font-medium text-green-600 dark:text-green-400"
										data-testid="applied-migrations-count"
									>
										{migrationStatus.dbInfo.appliedMigrations.length} applied
									</span>
									{migrationStatus.dbInfo.pendingMigrations > 0 && (
										<span
											className="text-sm font-medium text-yellow-600 dark:text-yellow-400"
											data-testid="pending-migrations-count"
										>
											{migrationStatus.dbInfo.pendingMigrations} pending
										</span>
									)}
								</>
							)}
						</div>
						{migrationStatus.message && (
							<p
								className={`text-sm ${
									migrationStatus.status === "error"
										? "text-red-600 dark:text-red-400"
										: "text-gray-600 dark:text-gray-400"
								}`}
								data-testid="migration-message"
							>
								{migrationStatus.message}
							</p>
						)}
					</div>

					{/* Database Info */}
					{migrationStatus.dbInfo && (
						<div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-6">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
								Database Information
							</h3>
							<div className="space-y-2" data-testid="db-info">
								<div>
									<span className="font-medium text-gray-700 dark:text-gray-300">
										Version:{" "}
									</span>
									<span
										className="text-gray-600 dark:text-gray-400"
										data-testid="db-version"
									>
										{migrationStatus.dbInfo.version}
									</span>
								</div>
								<div>
									<span className="font-medium text-gray-700 dark:text-gray-300">
										Applied Migrations:{" "}
									</span>
									<span
										className="text-gray-600 dark:text-gray-400"
										data-testid="applied-migrations-list"
									>
										{migrationStatus.dbInfo.appliedMigrations.length > 0
											? migrationStatus.dbInfo.appliedMigrations.join(", ")
											: "None"}
									</span>
								</div>
								<div>
									<span className="font-medium text-gray-700 dark:text-gray-300">
										Object Stores:{" "}
									</span>
									<ul className="mt-2 space-y-1 pl-4">
										{migrationStatus.dbInfo.objectStores.map((storeName) => {
											const indexCount =
												migrationStatus.dbInfo?.indexes[storeName]?.length ?? 0;
											return (
												<li
													key={storeName}
													className="text-gray-600 dark:text-gray-400"
												>
													<span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
														{storeName}
													</span>
													{indexCount > 0 && (
														<span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
															({indexCount} indexes)
														</span>
													)}
												</li>
											);
										})}
									</ul>
								</div>
								{Object.entries(migrationStatus.dbInfo.indexes).map(
									([storeName, storeIndexes]) =>
										storeIndexes.length > 0 && (
											<div key={storeName}>
												<span className="font-medium text-gray-700 dark:text-gray-300">
													Indexes on {storeName}:{" "}
												</span>
												<ul className="mt-2 space-y-1 pl-4">
													{storeIndexes.map((indexName) => (
														<li
															key={indexName}
															className="text-gray-600 dark:text-gray-400 text-sm"
														>
															• {indexName}
														</li>
													))}
												</ul>
											</div>
										),
								)}
							</div>
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-3 border-t border-gray-200 dark:border-gray-700 pt-6">
						<button
							type="button"
							onClick={runMigration}
							disabled={
								migrationStatus.status === "migrating" ||
								migrationStatus.status === "checking"
							}
							className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
							data-testid="run-migration-button"
						>
							{migrationStatus.status === "migrating"
								? "Migrating..."
								: migrationStatus.status === "checking"
									? "Checking..."
									: migrationStatus.dbInfo?.pendingMigrations === 0
										? "Re-run Migration"
										: "Run Migration"}
						</button>
						<button
							type="button"
							onClick={deleteMigration}
							disabled={
								migrationStatus.status === "migrating" ||
								migrationStatus.status === "checking"
							}
							className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
							data-testid="delete-db-button"
						>
							Delete Database
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function IndexedDBMigrationTest() {
	return <IndexedDBMigrationContent />;
}
