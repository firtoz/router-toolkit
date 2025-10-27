import { type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
import { useId } from "react";
import { useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/submitter-with-loader";

interface User {
	id: number;
	name: string;
	email: string;
	lastUpdated: string;
}

interface LoaderData {
	user: User;
}

type ActionData = {
	success: boolean;
	message: string;
	updatedUser?: User;
};

export const loader = async (): Promise<LoaderData> => {
	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	return {
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
			lastUpdated: new Date().toISOString(),
		},
	};
};

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;

	// Simulate processing delay (1 second for easier E2E testing)
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Simple validation
	if (!name || !email) {
		return {
			success: false,
			message: "Name and email are required",
		};
	}

	// Test-specific response for E2E
	if (email.includes("test-fetcher@example.com")) {
		return {
			success: true,
			message: "Fetcher test completed successfully!",
			updatedUser: {
				id: 1,
				name,
				email,
				lastUpdated: new Date().toISOString(),
			},
		};
	}

	const updatedUser: User = {
		id: 1,
		name,
		email,
		lastUpdated: new Date().toISOString(),
	};

	return {
		success: true,
		message: "User updated successfully!",
		updatedUser,
	};
}

export function meta() {
	return [
		{ title: "Submitter with Loader - Test Playground" },
		{
			name: "description",
			content: "Testing useDynamicSubmitter with useLoaderData integration",
		},
	];
}

export const route: RoutePath<"/submitter-with-loader"> =
	"/submitter-with-loader";

export const formSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export default function SubmitterWithLoader() {
	const loaderData = useLoaderData<LoaderData>();
	// useDynamicSubmitter for form submissions (POST)
	const submitter = useDynamicSubmitter<
		typeof import("./submitter-with-loader")
	>("/submitter-with-loader");
	const nameId = useId();
	const emailId = useId();
	return (
		<div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
			<h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Submitter with Loader Test
			</h1>
			<p className="mb-4 text-gray-600 dark:text-gray-400">
				Testing useDynamicSubmitter working alongside useLoaderData
			</p>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Loader Data Section */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
						Current User Data
					</h2>
					<div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded border border-blue-200 dark:border-blue-800">
						<h3 className="font-medium text-gray-900 dark:text-gray-100">
							Loaded from Server:
						</h3>
						<pre className="mt-2 text-sm bg-gray-200 dark:bg-gray-800 p-3 rounded text-gray-800 dark:text-gray-200">
							{JSON.stringify(loaderData.user, null, 2)}
						</pre>
					</div>
				</div>

				{/* Action Form Section */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
						Update User
					</h2>
					<submitter.Form method="post" className="space-y-4">
						<div>
							<label
								htmlFor={nameId}
								className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100"
							>
								Name:
							</label>
							<input
								id={nameId}
								name="name"
								type="text"
								defaultValue={loaderData.user.name}
								required
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
							/>
						</div>

						<div>
							<label
								htmlFor={emailId}
								className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100"
							>
								Email:
							</label>
							<input
								id={emailId}
								name="email"
								type="email"
								defaultValue={loaderData.user.email}
								required
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
							/>
						</div>

						<button
							type="submit"
							disabled={submitter.state === "submitting"}
							className="w-full bg-purple-500 dark:bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-purple-600 dark:hover:bg-purple-700 active:bg-purple-700 dark:active:bg-purple-800 transition-all hover:shadow-md disabled:hover:shadow-none"
							data-testid="submitter-submit-button"
						>
							{submitter.state === "submitting" ? "Updating..." : "Update User"}
						</button>
					</submitter.Form>
				</div>
			</div>

			{/* Status Section */}
			<div className="mt-6">
				<h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
					Submitter Status:
				</h2>
				<pre
					className="bg-gray-200 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200"
					data-testid="submitter-status"
				>
					{JSON.stringify({ state: submitter.state }, null, 2)}
				</pre>
			</div>

			{submitter.data && (
				<div className="mt-6" data-testid="action-result">
					<h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
						Action Result:
					</h2>
					<pre className="bg-gray-200 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200">
						{JSON.stringify(submitter.data, null, 2)}
					</pre>

					{submitter.data.success ? (
						<div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
							<p className="text-green-800 dark:text-green-300">
								✅ {submitter.data.message}
							</p>
							{submitter.data.updatedUser && (
								<p className="text-sm text-green-700 dark:text-green-400 mt-1">
									Updated: {submitter.data.updatedUser.name} (
									{submitter.data.updatedUser.email})
								</p>
							)}
						</div>
					) : (
						<div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
							<p className="text-red-800 dark:text-red-300">
								❌ {submitter.data.message}
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
