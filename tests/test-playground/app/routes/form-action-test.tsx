import { fail, success } from "@firtoz/maybe-error";
import {
	formAction,
	type RoutePath,
	useDynamicSubmitter,
} from "@firtoz/router-toolkit";
import { useId } from "react";
import { z } from "zod";

export const formSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.email("Invalid email format"),
	age: z.coerce.number().min(18, "Must be at least 18 years old"),
	terms: z.literal("on").refine((val) => val === "on", {
		message: "You must accept the terms",
	}),
});

export const action = formAction({
	schema: formSchema,
	handler: async (_args, data) => {
		// Simulate processing delay
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Simulate business logic
		if (data.email === "admin@example.com") {
			return fail("Admin email is not allowed for registration");
		}

		return success({
			message: "Registration successful!",
			user: {
				id: Math.random().toString(36).slice(2, 11),
				name: data.name,
				email: data.email,
				age: data.age,
			},
		});
	},
});

export const route: RoutePath<"/form-action-test"> = "/form-action-test";

export function meta() {
	return [
		{ title: "Form Action Test - Test Playground" },
		{
			name: "description",
			content: "Testing formAction utility with type-safe form handling",
		},
	];
}

export default function FormActionTest() {
	const submitter =
		useDynamicSubmitter<typeof import("./form-action-test")>(
			"/form-action-test",
		);

	const nameId = useId();
	const emailId = useId();
	const ageId = useId();
	const termsId = useId();

	return (
		<div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
			<h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Form Action Test
			</h1>
			<p className="mb-4 text-gray-600 dark:text-gray-400">
				Testing the formAction utility with Zod validation and type-safe error
				handling
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

				<div>
					<label
						htmlFor={ageId}
						className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100"
					>
						Age:
					</label>
					<input
						id={ageId}
						name="age"
						type="number"
						required
						min={18}
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
					/>
				</div>

				<div className="flex items-center">
					<input
						id={termsId}
						name="terms"
						type="checkbox"
						required
						className="mr-2"
					/>
					<label
						htmlFor={termsId}
						className="text-sm text-gray-900 dark:text-gray-100"
					>
						I accept the terms and conditions
					</label>
				</div>

				<button
					type="submit"
					disabled={submitter.state === "submitting"}
					className="w-full bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-600 dark:hover:bg-blue-700 active:bg-blue-700 dark:active:bg-blue-800 transition-all hover:shadow-md disabled:hover:shadow-none"
				>
					{submitter.state === "submitting" ? "Registering..." : "Register"}
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
								✅ Registration successful!
							</p>
							{submitter.data.result && (
								<div className="mt-2">
									<p className="text-sm text-green-700 dark:text-green-400">
										Welcome, {submitter.data.result.user.name}! User ID:{" "}
										{submitter.data.result.user.id}
									</p>
								</div>
							)}
						</div>
					) : (
						<div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
							<p className="text-red-800 dark:text-red-300">
								❌ Registration failed
							</p>
							{submitter.data.error.type === "validation" && (
								<div className="mt-2">
									<p className="text-sm text-red-700 dark:text-red-400">
										Validation errors:
									</p>
									<pre className="text-xs text-red-600 dark:text-red-400 mt-1">
										{JSON.stringify(submitter.data.error.error, null, 2)}
									</pre>
								</div>
							)}
							{submitter.data.error.type === "handler" && (
								<div className="mt-2">
									<p className="text-sm text-red-700 dark:text-red-400">
										Error: {submitter.data.error.error}
									</p>
								</div>
							)}
							{submitter.data.error.type === "unknown" && (
								<div className="mt-2">
									<p className="text-sm text-red-700 dark:text-red-400">
										An unexpected error occurred. Please try again.
									</p>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
				<h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
					Test Cases:
				</h3>
				<ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
					<li>• Try submitting with invalid email format</li>
					<li>• Try submitting with age less than 18</li>
					<li>• Try submitting without accepting terms</li>
					<li>
						• Try submitting with email "admin@example.com" (business logic
						error)
					</li>
					<li>• Submit valid data to see success response</li>
				</ul>
			</div>
		</div>
	);
}
