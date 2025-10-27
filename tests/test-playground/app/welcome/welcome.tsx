export function Welcome() {
	return (
		<nav className="space-y-4">
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
				@firtoz/router-toolkit Test Routes
			</h2>
			<ul className="space-y-2">
				{testRoutes.map(({ href, text, description }) => (
					<li key={href}>
						<a
							className="block p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer border border-gray-200/50 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
							href={href}
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
	);
}

const testRoutes = [
	{
		href: "/loader-test",
		text: "useDynamicFetcher (Loader)",
		description:
			"Test route with data loading functionality using React Router's useFetcher hook",
	},
	{
		href: "/action-test",
		text: "useDynamicSubmitter (Action)",
		description:
			"Test route with form submission and action handling capabilities",
	},
	{
		href: "/form-action-test",
		text: "formAction + useDynamicSubmitter",
		description: "Form validation with Zod schema and type-safe error handling",
	},
	{
		href: "/submitter-with-loader",
		text: "useDynamicSubmitter + useLoaderData",
		description: "Form submissions working alongside loader data",
	},
	{
		href: "/fetcher-data-refresh",
		text: "useDynamicFetcher (Data Fetching)",
		description: "Programmatic data fetching from loaders using fetcher.load()",
	},
	{
		href: "/fetcher-invalidation",
		text: "useDynamicFetcher (Invalidation)",
		description:
			"Data invalidation and revalidation with timestamp verification",
	},
];
