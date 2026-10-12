# Careline frontend

The existing JavaScript React/Vite UI now connects to the Express/MongoDB API in `../backend`. See the [workspace setup guide](../README.md) for configuration, account creation, database seeding, API endpoints, and verification status.

```sh
npm install
npm run dev
```

Open `http://localhost:5173` with the backend on port 5000. Vite proxies `/api`. Medical records and credentials are not stored in localStorage; appearance uses `careline-theme`.

`src/services/api.js` centralizes authenticated requests, CSRF, reports, private document uploads/downloads, and errors. `src/services/records.js` connects existing forms to REST endpoints while preserving the shared workspace structure. Fictional seed data lives in `../backend/scripts/fixtures.js`.

```sh
npm test
npm run build
node check-production.cjs
```

Frontend tests use an API contract harness. Run backend integration tests against a disposable MongoDB test database to verify real persistence and server authorization.
