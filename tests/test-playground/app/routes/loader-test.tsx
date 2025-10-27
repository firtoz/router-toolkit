import { type RoutePath, useDynamicFetcher } from "@firtoz/router-toolkit";

interface LoaderData {
	user: {
		id: number;
		name: string;
		email: string;
	};
	timestamp: string;
}

export const loader = async (): Promise<LoaderData> => {
	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Return test user data
	return {
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
		},
		timestamp: new Date().toISOString(),
	};
};

export function meta() {
	return [
		{ title: "Loader Test - Test Playground" },
		{ name: "description", content: "Testing @firtoz/router-toolkit hooks" },
	];
}

export const route: RoutePath<"/loader-test"> = "/loader-test";

export default function LoaderTest() {
	const fetcher =
		useDynamicFetcher<typeof import("./loader-test")>("/loader-test");

	const handleRefresh = () => {
		fetcher.load();
	};

	return (
		<div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
			<h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Loader Test
			</h1>
			<p className="mb-4 text-gray-600 dark:text-gray-400">
				Testing React Router useFetcher hook
			</p>

			<button
				type="button"
				onClick={handleRefresh}
				disabled={fetcher.state === "loading"}
				className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-600 dark:hover:bg-blue-700 active:bg-blue-700 dark:active:bg-blue-800 transition-all hover:shadow-md"
			>
				{fetcher.state === "loading" ? "Loading..." : "Refresh Data"}
			</button>

			<div className="mt-6">
				<h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
					Fetcher State:
				</h2>
				<pre className="bg-gray-200 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200">
					{JSON.stringify({ state: fetcher.state }, null, 2)}
				</pre>
			</div>

			{fetcher.data && (
				<div className="mt-6">
					<h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
						Fetched Data:
					</h2>
					<pre className="bg-gray-200 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200">
						{JSON.stringify(fetcher.data, null, 2)}
					</pre>
				</div>
			)}

			{fetcher.state === "idle" && fetcher.data && (
				<div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
					<p className="text-green-800 dark:text-green-300">
						✅ Data loaded successfully!
					</p>
				</div>
			)}
		</div>
	);
}
