# Test Playground

A testing ground for various packages and utilities, built with React Router v7.

## Purpose

This application serves as a test playground to verify functionality and integration of various packages including:

- **@firtoz/router-toolkit** - Type-safe routing utilities for React Router
- **@firtoz/maybe-error** - Error handling utilities
- Additional packages can be added as needed

## Features

- 🚀 Server-side rendering with React Router v7
- ⚡️ Hot Module Replacement (HMR)
- 🔒 TypeScript by default
- 🎨 TailwindCSS with dark mode support
- 🧪 E2E testing with Playwright
- 📦 Asset bundling and optimization

## Getting Started

### Installation

Install the dependencies from the repository root:

```bash
bun install
```

### Development

Start the development server from the test-playground directory:

```bash
cd tests/test-playground
bun run dev
```

Your application will be available at `http://localhost:5173`.

### Testing

Run E2E tests:

```bash
bun run test:e2e
```

## Available Test Routes

### @firtoz/router-toolkit Tests

- **/loader-test** - Testing `useDynamicFetcher` for data loading
- **/action-test** - Testing `useDynamicSubmitter` for form actions
- **/form-action-test** - Testing `formAction` with Zod validation
- **/submitter-with-loader** - Testing integration of submitter with loader data
- **/fetcher-data-refresh** - Testing programmatic data fetching
- **/fetcher-invalidation** - Testing data invalidation and revalidation

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
