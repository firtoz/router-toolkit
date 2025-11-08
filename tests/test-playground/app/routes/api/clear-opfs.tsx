import type { RoutePath } from "@firtoz/router-toolkit";
import { useEffect, useRef, useState } from "react";
import ClearOpfsWorker from "~/workers/clear-opfs.worker?worker";
import { ClearOpfsWorkerClient } from "~/utils/clear-opfs.client";
import type { OpfsEntry } from "~/workers/clear-opfs.schema";

export default function ClearOpfs() {
	const [status, setStatus] = useState<{
		type: "idle" | "loading" | "success" | "error";
		message?: string;
	}>({ type: "idle" });
	const [entries, setEntries] = useState<OpfsEntry[]>([]);
	const [isListing, setIsListing] = useState(false);
	const clientRef = useRef<ClearOpfsWorkerClient | null>(null);
	const [workerReady, setWorkerReady] = useState(false);

	useEffect(() => {
		// Create worker and client
		const worker = new ClearOpfsWorker();
		const client = new ClearOpfsWorkerClient(worker);
		clientRef.current = client;

		// Set up callbacks
		client.onReady(() => {
			setWorkerReady(true);
			// Automatically list on ready
			client.list();
			setIsListing(true);
		});

		client.onCleared((count) => {
			setStatus({
				type: "success",
				message: `Successfully cleared ${count} OPFS entries`,
			});
			// Refresh the list after clearing
			client.list();
			setIsListing(true);
		});

		client.onListed((newEntries) => {
			setEntries(newEntries);
			setIsListing(false);
		});

		client.onError((error) => {
			setStatus({
				type: "error",
				message: `Error: ${error}`,
			});
			setIsListing(false);
		});

		// Cleanup on unmount
		return () => {
			client.terminate();
		};
	}, []);

	const clearOPFS = () => {
		if (!clientRef.current || !workerReady) {
			setStatus({
				type: "error",
				message: "Worker not ready",
			});
			return;
		}

		setStatus({ type: "loading" });
		clientRef.current.clear();
	};

	const refreshList = () => {
		if (!clientRef.current || !workerReady) {
			return;
		}
		setIsListing(true);
		clientRef.current.list();
	};

	const renderEntry = (entry: OpfsEntry, depth = 0) => {
		const indent = depth * 24;
		const isDirectory = entry.kind === "directory";

		return (
			<div key={entry.path}>
				<div
					className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
					style={{ paddingLeft: `${indent + 8}px` }}
				>
					<span className="text-lg">{isDirectory ? "📁" : "📄"}</span>
					<span className="font-mono text-gray-900 dark:text-gray-100">
						{entry.name}
					</span>
					<span className="text-xs text-gray-500 dark:text-gray-400">
						{entry.path}
					</span>
				</div>
				{isDirectory && entry.children && entry.children.length > 0 && (
					<div>
						{entry.children.map((child) => renderEntry(child, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="max-w-4xl mx-auto p-8 space-y-6">
			{/* Clear OPFS Section */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-2 border-gray-200 dark:border-gray-700">
				<h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
					Clear OPFS Storage
				</h1>
				<p className="text-gray-600 dark:text-gray-400 mb-4">
					This will clear all OPFS (Origin Private File System) storage for this
					origin.
				</p>
				<p className="text-red-600 dark:text-red-400 font-semibold mb-6">
					⚠️ Warning: This action cannot be undone!
				</p>

				<button
					type="button"
					onClick={clearOPFS}
					disabled={status.type === "loading" || !workerReady}
					className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg disabled:cursor-not-allowed"
				>
					{!workerReady
						? "Initializing worker..."
						: status.type === "loading"
							? "Clearing..."
							: "Clear All OPFS Data"}
				</button>

				{status.type === "success" && (
					<div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
						<p className="text-green-700 dark:text-green-300 font-medium">
							✓ {status.message}
						</p>
					</div>
				)}

				{status.type === "error" && (
					<div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
						<p className="text-red-700 dark:text-red-300 font-medium">
							✗ {status.message}
						</p>
					</div>
				)}
			</div>

			{/* OPFS Directory Listing Section */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-2 border-gray-200 dark:border-gray-700">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
						OPFS Directory Structure
					</h2>
					<button
						type="button"
						onClick={refreshList}
						disabled={isListing || !workerReady}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md disabled:cursor-not-allowed flex items-center gap-2"
					>
						<span>{isListing ? "Refreshing..." : "🔄 Refresh"}</span>
					</button>
				</div>

				{isListing && (
					<div className="text-gray-600 dark:text-gray-400 py-4">
						Loading directory structure...
					</div>
				)}

				{!isListing && entries.length === 0 && (
					<div className="text-gray-500 dark:text-gray-400 italic py-4">
						OPFS is empty
					</div>
				)}

				{!isListing && entries.length > 0 && (
					<div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
						{entries.map((entry) => renderEntry(entry))}
					</div>
				)}

				{entries.length > 0 && (
					<div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
						Total entries: {entries.length}
					</div>
				)}
			</div>
		</div>
	);
}

export const route: RoutePath<"/api/clear-opfs"> = "/api/clear-opfs";
