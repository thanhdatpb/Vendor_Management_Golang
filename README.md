# HappyC-Hub Vendor Management

Internal system for managing vendor sourcing, product pricing, and product request approval workflows.

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19 · Vite · React Router |
| Backend | Go · `net/http` (stdlib) · REST API |
| Database | MySQL 8.0 |
| Media storage | S3-compatible object storage |
| Realtime | Pusher Channels |

## Project Structure

```
backend-go/          Go API service
  cmd/server/        HTTP entrypoint
  cmd/migrate/       database migration CLI
  internal/          application code (handlers, domain logic, auth, media)
  migrations/        SQL schema migrations

frontend/            React SPA
  src/pages/         top-level views per role
  src/components/    UI components
  src/utils/         pricing engine & data helpers
  src/services/      API client, realtime client
```

## Getting Started

**Prerequisites:** Go 1.23+, Node.js 20+, MySQL 8.0 (or `docker compose up -d`).

```bash
# Backend
cd backend-go
# create .env with DB, mail, storage and realtime credentials
# (required variables are listed in internal/config/config.go)
go run ./cmd/migrate up
go run ./cmd/server

# Frontend
cd frontend
npm install
npm run dev
```

## Testing

```bash
cd backend-go && go test ./...
cd frontend   && npm run test
```

## Roles

The system supports several roles (Admin, Sales, Operations, and a few read-only roles) with server-side, per-role field-level access control.

## License

Internal / proprietary. Not for public distribution.
