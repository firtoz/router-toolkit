import { type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
import { useId } from "react";
import { z } from "zod";
import type { Route } from "./+types/action-test";

interface ActionData {
	success: boolean;
	message: string;
	submittedData?: {
		name: string;
		email: string;
	};
}

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;

	// Simulate processing delay
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Simple validation
	if (!name || !email) {
		return {
			success: false,
			message: "Name and email are required",
		};
	}

	return {
		success: true,
		message: "Form submitted successfully!",
		submittedData: { name, email },
	};
}

export function meta() {
	return [
		{ title: "Action Test - Test Playground" },
		{ name: "description", content: "Testing useDynamicSubmitter hook" },
	];
}

export const route: RoutePath<"/action-test"> = "/action-test";

export const formSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export default function ActionTest() {
	// useDynamicSubmitter would be used here with proper route registration and form schema
	const submitter =
		useDynamicSubmitter<typeof import("./action-test")>("/action-test");

	const nameId = useId();
	const emailId = useId();

	return (
		<div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
			<h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Action Test
			</h1>
			<p className="mb-4 text-gray-600 dark:text-gray-400">
				Testing React Router form actions
			</p>

			<submitter.Form method="post" className="space-y-4 max-w-md">
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
						required
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
					/>
				</div>

				<button
					type="submit"
					disabled={submitter.state === "submitting"}
					className="w-full bg-green-500 dark:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-green-600 dark:hover:bg-green-700 active:bg-green-700 dark:active:bg-green-800 transition-all hover:shadow-md disabled:hover:shadow-none"
				>
					{submitter.state === "submitting" ? "Submitting..." : "Submit"}
				</button>
			</submitter.Form>

			<div className="mt-6">
				<h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
					Fetcher State:
				</h2>
				<pre className="bg-gray-200 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200">
					{JSON.stringify({ state: submitter.state }, null, 2)}
				</pre>
			</div>

			{submitter.data && (
				<div className="mt-6">
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
