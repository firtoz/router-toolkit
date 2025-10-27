import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("loader-test", "routes/loader-test.tsx"),
	route("action-test", "routes/action-test.tsx"),
	route("form-action-test", "routes/form-action-test.tsx"),
	route("submitter-with-loader", "routes/submitter-with-loader.tsx"),
	route("fetcher-data-refresh", "routes/fetcher-data-refresh.tsx"),
	route("fetcher-invalidation", "routes/fetcher-invalidation.tsx"),
] satisfies RouteConfig;
