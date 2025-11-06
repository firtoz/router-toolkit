import { href } from "react-router";

export function Welcome() {
	return (
		<div className="space-y-8">
			{/* Router Toolkit Tests */}
			<nav className="space-y-4">
				<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
					@firtoz/router-toolkit Test Routes
				</h2>
				<ul className="space-y-2">
					{routerToolkitRoutes.map(({ path, text, description }) => (
						<li key={path}>
							<a
								className="block p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer border border-gray-200/50 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
								href={href(path)}
							>
								<div className="text-blue-700 dark:text-blue-400 font-medium transition-colors">
									{text}
								</div>
								<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
									{description}
								</div>
							</a>
						</li>
					))}
				</ul>
			</nav>

			{/* Drizzle SQLite WASM Tests */}
			<nav className="space-y-4">
				<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
					@firtoz/drizzle-sqlite-wasm Test Routes
				</h2>
				<ul className="space-y-2">
					{sqliteRoutes.map(({ path, text, description }) => (
						<li key={path}>
							<a
								className="block p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all cursor-pointer border border-gray-200/50 dark:border-gray-700/50 hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm"
								href={href(path)}
							>
								<div className="text-green-700 dark:text-green-400 font-medium transition-colors">
									{text}
								</div>
								<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
									{description}
								</div>
							</a>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}

const routerToolkitRoutes = [
	{
		path: "/router-toolkit/loader-test" as const,
		text: "useDynamicFetcher (Loader)",
		description:
			"Test route with data loading functionality using React Router's useFetcher hook",
	},
	{
		path: "/router-toolkit/action-test" as const,
		text: "useDynamicSubmitter (Action)",
		description:
			"Test route with form submission and action handling capabilities",
	},
	{
		path: "/router-toolkit/form-action-test" as const,
		text: "formAction + useDynamicSubmitter",
		description: "Form validation with Zod schema and type-safe error handling",
	},
	{
		path: "/router-toolkit/submitter-with-loader" as const,
		text: "useDynamicSubmitter + useLoaderData",
		description: "Form submissions working alongside loader data",
	},
	{
		path: "/router-toolkit/fetcher-data-refresh" as const,
		text: "useDynamicFetcher (Data Fetching)",
		description: "Programmatic data fetching from loaders using fetcher.load()",
	},
	{
		path: "/router-toolkit/fetcher-invalidation" as const,
		text: "useDynamicFetcher (Invalidation)",
		description:
			"Data invalidation and revalidation with timestamp verification",
	},
];

const sqliteRoutes = [
	{
		path: "/sqlite/sqlite-test" as const,
		text: "DrizzleProvider + useCollection",
		description:
			"SQLite WASM with Drizzle ORM: Real-time queries with live updates using useLiveQuery",
	},
];
