import { type RoutePath, useDynamicFetcher } from "@firtoz/router-toolkit";
import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/fetcher-invalidation";

interface TimeData {
	timestamp: string;
	loadCount: number;
	message: string;
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	// Get query param to track load count
	const url = new URL(request.url);
	const count = Number.parseInt(url.searchParams.get("count") || "0", 10);

	// Simulate some delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	return {
		timestamp: new Date().toISOString(),
		loadCount: count + 1,
		message: `Data loaded at ${new Date().toLocaleTimeString()}`,
	};
};

export function meta() {
	return [
		{ title: "Fetcher Invalidation - Test Playground" },
		{
			name: "description",
			content: "Testing useDynamicFetcher data invalidation and revalidation",
		},
	];
}

export const route: RoutePath<"/router-toolkit/fetcher-invalidation"> =
	"/router-toolkit/fetcher-invalidation";

export default function FetcherInvalidation() {
	const initialData = useLoaderData<TimeData>();
	const [fetchHistory, setFetchHistory] = useState<TimeData[]>([initialData]);

	// useDynamicFetcher for loading fresh data
	const fetcher = useDynamicFetcher<typeof import("./fetcher-invalidation")>(
		"/router-toolkit/fetcher-invalidation",
	);

	const handleLoadData = () => {
		const currentCount = fetcher.data?.loadCount || initialData.loadCount;
		fetcher.load({ count: String(currentCount) });
	};

	// Track fetcher data in history
	const handleLoadAndTrack = () => {
		handleLoadData();
	};

	// Add to history when fetcher completes
	if (fetcher.data && fetcher.state === "idle") {
		const lastHistoryItem = fetchHistory[fetchHistory.length - 1];
		if (lastHistoryItem?.timestamp !== fetcher.data.timestamp) {
			setFetchHistory([...fetchHistory, fetcher.data]);
		}
	}

	const currentData = fetcher.data || initialData;

	return (
		<div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
			<Link
				to="/"
				className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors"
			>
				← Back to Home
			</Link>
			<h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Fetcher Invalidation Test
			</h1>
			<p className="mb-4 text-gray-600 dark:text-gray-400">
				Testing useDynamicFetcher data invalidation - each fetch should return a
				different timestamp
			</p>

			<div className="space-y-6">
				{/* Current Data */}
				<div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded border border-blue-200 dark:border-blue-800">
					<h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
						Current Data
					</h2>
					<div className="space-y-2">
						<div
							data-testid="current-timestamp"
							className="font-mono text-sm text-gray-900 dark:text-gray-100"
						>
							<strong>Timestamp:</strong> {currentData.timestamp}
						</div>
						<div
							data-testid="load-count"
							className="font-mono text-sm text-gray-900 dark:text-gray-100"
						>
							<strong>Load Count:</strong> {currentData.loadCount}
						</div>
						<div className="text-sm text-gray-600 dark:text-gray-400">
							{currentData.message}
						</div>
					</div>
				</div>

				{/* Fetcher State */}
				<div>
					<h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
						Fetcher State:
					</h2>
					<pre
						className="bg-gray-200 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200"
						data-testid="fetcher-state"
					>
						{JSON.stringify({ state: fetcher.state }, null, 2)}
					</pre>
				</div>

				{/* Control Buttons */}
				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleLoadAndTrack}
						disabled={fetcher.state !== "idle"}
						className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-600 dark:hover:bg-blue-700 active:bg-blue-700 dark:active:bg-blue-800 transition-all hover:shadow-md disabled:hover:shadow-none"
						data-testid="invalidate-button"
					>
						{fetcher.state === "loading"
							? "Revalidating..."
							: "Invalidate & Reload Data"}
					</button>
				</div>

				{/* Fetch History */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
						Fetch History (Shows Data Invalidation)
					</h2>
					<div
						className="space-y-2 max-h-64 overflow-y-auto"
						data-testid="fetch-history"
					>
						{fetchHistory.map((data, index) => (
							<div
								key={data.timestamp}
								className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm border border-gray-200 dark:border-gray-700"
								data-fetch-index={index}
							>
								<div className="font-semibold text-gray-900 dark:text-gray-100">
									Fetch #{data.loadCount} {index === 0 && "(Initial Page Load)"}
									{index === fetchHistory.length - 1 && index > 0 && "(Latest)"}
								</div>
								<div className="font-mono text-xs text-gray-600 dark:text-gray-400">
									{data.timestamp}
								</div>
								<div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
									{data.message}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Info */}
				<div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded text-sm border border-yellow-200 dark:border-yellow-800">
					<p className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
						📚 What's being tested:
					</p>
					<ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
						<li>
							<strong>Data Invalidation</strong> - Each fetch returns fresh data
						</li>
						<li>
							<strong>Timestamp Changes</strong> - Proves data is actually
							reloading
						</li>
						<li>
							<strong>fetcher.load()</strong> - Programmatic revalidation
						</li>
						<li>
							<strong>State Management</strong> - Tracking loading/idle states
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
