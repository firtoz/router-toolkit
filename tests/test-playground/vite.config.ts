import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type PluginOption } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		devtoolsJson(),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
		// This is required for OPFS to work for sqlite-wasm.
		{
			name: "configure-response-headers",
			configureServer: (server) => {
				server.middlewares.use((_req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});
			},
		},
	] as PluginOption[],
	server: {
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	dev: {},
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"],
	},
	resolve: {
		alias: [
			{
				// Alias all .sql imports to .sql?raw
				find: /\.sql$/,
				replacement: ".sql?raw",
			},
		],
	},
});
