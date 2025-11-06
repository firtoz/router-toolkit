import type { RoutePath } from "@firtoz/router-toolkit";
import { useEffect, useRef, useState } from "react";
import ClearOpfsWorker from "~/workers/clear-opfs.worker?worker";
import { ClearOpfsWorkerClient } from "~/utils/clear-opfs.client";

export default function ClearOpfs() {
	const [status, setStatus] = useState<{
		type: "idle" | "loading" | "success" | "error";
		message?: string;
	}>({ type: "idle" });
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
		});

		client.onCleared((count) => {
			setStatus({
				type: "success",
				message: `Successfully cleared ${count} OPFS entries`,
			});
		});

		client.onError((error) => {
			setStatus({
				type: "error",
				message: `Failed to clear OPFS: ${error}`,
			});
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

	return (
		<div className="max-w-2xl mx-auto p-8">
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
		</div>
	);
}

export const route: RoutePath<"/api/clear-opfs"> = "/api/clear-opfs";
