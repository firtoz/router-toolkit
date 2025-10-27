import { type RoutePath, useDynamicFetcher } from "@firtoz/router-toolkit";
import type { Route } from "./+types/fetcher-data-refresh";

interface UserData {
	id: number;
	name: string;
	email: string;
	lastFetch: string;
	fetchCount: number;
}

export const loader = async ({
	request,
}: Route.LoaderArgs): Promise<{ user: UserData }> => {
	// Simulate API call
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Get query params to track fetch count
	const url = new URL(request.url);
	const count = Number.parseInt(url.searchParams.get("count") || "0", 10);

	return {
		user: {
			id: 1,
			name: "Jane Doe",
			email: "jane@example.com",
			lastFetch: new Date().toISOString(),
			fetchCount: count + 1,
		},
	};
};

export function meta() {
	return [
		{ title: "Fetcher Data Refresh - Test Playground" },
		{
			name: "description",
			content:
				"Testing useDynamicFetcher for programmatic data fetching from loader",
		},
	];
}

export const route: RoutePath<"/fetcher-data-refresh"> =
	"/fetcher-data-refresh";

export default function FetcherDataRefresh() {
	// useDynamicFetcher for loading data from loader endpoint
	const fetcher = useDynamicFetcher<typeof import("./fetcher-data-refresh")>(
		"/fetcher-data-refresh",
	);

	const handleRefresh = () => {
		// Use fetcher.load() to fetch fresh data from the loader
		const currentCount = fetcher.data?.user.fetchCount || 0;
		fetcher.load({ count: String(currentCount) });
	};

	const currentData = fetcher.data;

	return (
		<div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
			<h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Fetcher Data Refresh Test
			</h1>
			<p className="mb-4 text-gray-600 dark:text-gray-400">
				Testing useDynamicFetcher for fetching data from a loader endpoint
			</p>

			<div className="space-y-6">
				{/* Current Data */}
				{currentData && (
					<div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded border border-blue-200 dark:border-blue-800">
						<h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
							Current Data
						</h2>
						<pre
							className="bg-white dark:bg-gray-800 p-3 rounded text-sm text-gray-900 dark:text-gray-100"
							data-testid="user-data"
						>
							{JSON.stringify(currentData.user, null, 2)}
						</pre>
					</div>
				)}

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

				{/* Refresh Button */}
				<div>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={fetcher.state !== "idle"}
						className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-600 dark:hover:bg-blue-700 active:bg-blue-700 dark:active:bg-blue-800 transition-all hover:shadow-md disabled:hover:shadow-none"
						data-testid="refresh-button"
					>
						{fetcher.state === "loading"
							? "Loading..."
							: "Refresh Data (fetcher.load)"}
					</button>
				</div>

				{/* Info */}
				<div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded text-sm border border-yellow-200 dark:border-yellow-800">
					<p className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
						📚 What's being tested:
					</p>
					<ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
						<li>
							<strong>useDynamicFetcher</strong> - For fetching data from
							loaders
						</li>
						<li>
							<strong>fetcher.load()</strong> - Programmatic data refresh
						</li>
						<li>
							<strong>Loading states</strong> - idle → loading → idle
						</li>
						<li>
							<strong>Type-safe data</strong> - Full type inference from loader
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
