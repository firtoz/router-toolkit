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
		<div>
			<h1>Test Playground</h1>
			<p>Testing ground for various packages and utilities</p>
			<Welcome />
		</div>
	);
}
