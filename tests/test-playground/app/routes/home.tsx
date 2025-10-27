import { Welcome } from "../welcome/welcome";

export function meta() {
	return [
		{ title: "Test Playground" },
		{
			name: "description",
			content: "Test playground for various packages",
		},
	];
}

export default function Home() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<div className="max-w-4xl mx-auto py-8 px-4">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
						Test Playground
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Testing ground for various packages and utilities
					</p>
				</div>

				{/* Test Routes Section */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
					<Welcome />
				</div>
			</div>
		</div>
	);
}
