import fs from "node:fs";
import path from "node:path";

const drizzleDir = path.join(import.meta.dir, "drizzle");

if (fs.existsSync(drizzleDir)) {
	const files = fs.readdirSync(drizzleDir);

	for (const file of files) {
		if (file === "migrations.d.ts") {
			continue;
		}

		const filePath = path.join(drizzleDir, file);
		console.log(`Deleting: ${file}`);
		fs.rmSync(filePath, { recursive: true, force: true });
	}
	console.log("Reset complete.");
} else {
	console.log("drizzle directory not found.");
}
