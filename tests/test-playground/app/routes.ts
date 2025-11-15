import {
	index,
	prefix,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("api/clear-opfs", "routes/api/clear-opfs.tsx"),
	...prefix("sqlite", [
		route("sqlite-test", "routes/sqlite/sqlite-test.tsx"),
		route("sqlite-test/:dbName", "routes/sqlite/sqlite-test-dynamic.tsx"),
		route("indexeddb-test", "routes/sqlite/indexeddb-test.tsx"),
		route(
			"indexeddb-migration-test",
			"routes/sqlite/indexeddb-migration-test.tsx",
		),
	]),
	...prefix("router-toolkit", [
		route("loader-test", "routes/router-toolkit/loader-test.tsx"),
		route("action-test", "routes/router-toolkit/action-test.tsx"),
		route("form-action-test", "routes/router-toolkit/form-action-test.tsx"),
		route(
			"submitter-with-loader",
			"routes/router-toolkit/submitter-with-loader.tsx",
		),
		route(
			"fetcher-data-refresh",
			"routes/router-toolkit/fetcher-data-refresh.tsx",
		),
		route(
			"fetcher-invalidation",
			"routes/router-toolkit/fetcher-invalidation.tsx",
		),
	]),
] satisfies RouteConfig;
