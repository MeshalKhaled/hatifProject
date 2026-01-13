# Simple Drive

A complete blob storage system with pluggable storage backends, built as a take-home project demonstrating clean architecture, strong validation, and modern UI.

## Features

- **Pluggable Storage Backends**: Switch between Local filesystem, Database, S3-compatible (MinIO), and FTP storage
- **Strict API Validation**: Comprehensive input validation with proper error handling
- **Bearer Token Authentication**: Secure API access with token-based authentication
- **Modern UI**: Clean, responsive Next.js interface with Tailwind CSS
- **AWS Signature V4**: Manual implementation for S3/MinIO compatibility (no SDKs)
- **Raw HTTP Only**: We do not use any S3 SDK; only raw HTTP requests with manual signature signing
- **One-Command Deployment**: Run everything with `docker compose up --build`

## Quick Start

### Prerequisites

- Docker and Docker Compose
- pnpm (for local development)

### Run Everything

```bash
docker compose up --build
```

This will start:

- **API**: http://localhost:8080
- **UI**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **MinIO**: http://localhost:9000 (console: http://localhost:9001)
- **FTP**: localhost:21 (optional)

The API will automatically run Prisma migrations on startup.

## Testing

Run tests with a single command:

```bash
docker compose run --rm api-test
```

This will:

- Start PostgreSQL (if not already running)
- Run database migrations
- Execute all unit and integration tests
- Use the `db` storage backend for stability

Tests include:

- Authentication tests (Bearer token validation)
- Blob API integration tests (POST, GET, validation, errors)
- Storage backend sanity tests

## Verification

### No S3 SDK Usage

We implement S3/MinIO compatibility using **only raw HTTP requests** and manual AWS Signature V4 signing. No AWS SDK or MinIO SDK is used.

**Verify compliance:**

```bash
./verify-no-sdk.sh
```

This script:

- Scans only our source code (`apps/api/src`, `apps/ui/app`, `apps/ui/src`)
- Excludes `node_modules`, `.pnpm-store`, `dist`, `.next`, and other build artifacts
- Checks for any `aws-sdk`, `@aws-sdk`, or `minio/client` imports
- Verifies `package.json` files don't include SDK dependencies

**Our S3 implementation uses:**

- Native `fetch()` API (Node.js 20+)
- Manual AWS Signature V4 implementation (`apps/api/src/storage/s3/sigv4.ts`)
- Raw HTTP requests via `fetch()` (`apps/api/src/storage/s3/client.ts`)
- No external S3 SDK dependencies

## API Documentation

### Authentication

All API requests require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

Default token: `supersecret` (set via `API_TOKEN` env var)

### Endpoints

#### POST /v1/blobs

Upload a new blob.

**Request:**

```json
{
  "id": "my-blob-id",
  "data": "SGVsbG8gV29ybGQ="
}
```

- `id`: String, 1-512 characters, must be unique
- `data`: Base64-encoded string (must be valid base64)

**Response (201):**

```json
{
  "id": "my-blob-id",
  "size": "11",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Error Codes:**

- `400`: Invalid input (invalid base64, invalid id format)
- `401`: Missing or invalid bearer token
- `409`: Blob with this id already exists
- `500`: Internal server error

#### GET /v1/blobs/:id

Retrieve a blob by ID.

**Response (200):**

```json
{
  "id": "my-blob-id",
  "data": "SGVsbG8gV29ybGQ=",
  "size": "11",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Error Codes:**

- `401`: Missing or invalid bearer token
- `404`: Blob not found
- `500`: Internal server error

### cURL Examples

**Upload a blob:**

```bash
curl -X POST http://localhost:8080/v1/blobs \
  -H "Authorization: Bearer supersecret" \
  -H "Content-Type: application/json" \
  -d '{"id": "test-123", "data": "SGVsbG8gV29ybGQ="}'
```

**Retrieve a blob:**

```bash
curl http://localhost:8080/v1/blobs/test-123 \
  -H "Authorization: Bearer supersecret"
```

## Configuration

### Environment Variables

#### API Service

| Variable          | Required | Default | Description                                 |
| ----------------- | -------- | ------- | ------------------------------------------- |
| `API_TOKEN`       | Yes      | -       | Bearer token for API authentication         |
| `DATABASE_URL`    | Yes      | -       | PostgreSQL connection string                |
| `STORAGE_BACKEND` | No       | `local` | Storage backend: `local`, `db`, `s3`, `ftp` |
| `PORT`            | No       | `8080`  | API server port                             |

#### Local Storage Backend

| Variable    | Required | Default       | Description                 |
| ----------- | -------- | ------------- | --------------------------- |
| `LOCAL_DIR` | No       | `/data/blobs` | Directory for storing blobs |

#### Database Storage Backend

No additional variables needed. Uses the same `DATABASE_URL` as metadata.

#### S3 Storage Backend

| Variable        | Required | Default     | Description                                 |
| --------------- | -------- | ----------- | ------------------------------------------- |
| `S3_ENDPOINT`   | Yes      | -           | S3 endpoint URL (e.g., `http://minio:9000`) |
| `S3_BUCKET`     | Yes      | -           | S3 bucket name                              |
| `S3_ACCESS_KEY` | Yes      | -           | S3 access key                               |
| `S3_SECRET_KEY` | Yes      | -           | S3 secret key                               |
| `S3_REGION`     | No       | `us-east-1` | AWS region                                  |

#### FTP Storage Backend

| Variable   | Required | Default | Description                     |
| ---------- | -------- | ------- | ------------------------------- |
| `FTP_HOST` | Yes      | -       | FTP server hostname             |
| `FTP_USER` | Yes      | -       | FTP username                    |
| `FTP_PASS` | Yes      | -       | FTP password                    |
| `FTP_DIR`  | No       | `/`     | FTP directory for storing blobs |

#### UI Service

| Variable                | Required | Default                 | Description                                 |
| ----------------------- | -------- | ----------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | No       | `http://localhost:8080` | API base URL                                |
| `NEXT_PUBLIC_API_TOKEN` | No       | `supersecret`           | Default API token (can be overridden in UI) |

### Switching Storage Backends

Edit `docker-compose.yml` and change the `STORAGE_BACKEND` environment variable:

```yaml
api:
  environment:
    STORAGE_BACKEND: s3 # or: local, db, ftp
```

Then restart:

```bash
docker compose restart api
```

## Architecture

### Storage Architecture

The system uses a **metadata + storage** separation pattern:

1. **Metadata Table (`blobs`)**: Stores blob metadata (id, size, checksum, storage key, backend type)
2. **Storage Backend**: Stores actual blob data based on configured backend

This design allows:

- Easy backend switching without data migration
- Multiple backends to coexist
- Efficient querying of metadata without loading blob data

### Storage Key Derivation

All backends use SHA256 hash of the blob ID as the storage key:

- Prevents path traversal attacks
- Ensures consistent key format across backends
- Enables backend migration by rehashing IDs

### AWS Signature V4 Implementation

The S3 backend implements AWS Signature V4 manually (no SDKs) for:

- Canonical request construction
- String-to-sign generation
- Signing key derivation (HMAC-SHA256 chain)
- Authorization header generation

This ensures compatibility with any S3-compatible service (MinIO, AWS S3, etc.) using only standard HTTP libraries.

### API Design

- **Strict Validation**: All inputs validated with clear error messages
- **Idempotent Operations**: POST returns 409 if blob exists (no overwrite)
- **Consistent Error Format**: All errors return `{ error: string }`
- **UTC Timestamps**: All timestamps in ISO 8601 format with Z suffix
- **String Sizes**: Size returned as string per API contract

## Database Schema

### Metadata Table: `blobs`

```sql
CREATE TABLE blobs (
  id TEXT PRIMARY KEY,
  backend TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Storage Table: `blob_data_store` (for DB backend)

```sql
CREATE TABLE blob_data_store (
  key TEXT PRIMARY KEY,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Testing

Run tests:

```bash
cd apps/api
pnpm test
```

Test coverage includes:

- Authentication (401 errors)
- Input validation (invalid base64, empty id)
- CRUD operations (create, retrieve)
- Duplicate detection (409 errors)
- Not found handling (404 errors)

## Project Structure

```
/
├── docker-compose.yml          # One-command deployment
├── package.json                # Workspace root
├── pnpm-workspace.yaml         # pnpm workspace config
├── apps/
│   ├── api/                    # Fastify API server
│   │   ├── src/
│   │   │   ├── server.ts       # Fastify server setup
│   │   │   ├── env.ts          # Environment config
│   │   │   ├── auth/           # Bearer token auth
│   │   │   ├── routes/         # API routes
│   │   │   └── storage/        # Storage backends
│   │   │       ├── types.ts    # Storage interface
│   │   │       ├── factory.ts  # Backend factory
│   │   │       ├── local.ts    # Local filesystem
│   │   │       ├── db.ts       # Database storage
│   │   │       ├── s3/         # S3/MinIO (SigV4)
│   │   │       └── ftp.ts      # FTP storage
│   │   ├── prisma/             # Prisma schema & migrations
│   │   └── Dockerfile
│   └── ui/                     # Next.js UI
│       ├── app/                # App Router pages
│       ├── components/         # React components
│       └── Dockerfile
└── README.md
```

## Development

### Local Development (without Docker)

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL and MinIO:

```bash
docker compose up postgres minio -d
```

3. Set up database:

```bash
cd apps/api
pnpm prisma migrate dev
```

4. Start API:

```bash
cd apps/api
API_TOKEN=supersecret DATABASE_URL=postgresql://postgres:postgres@localhost:5432/simpledrive STORAGE_BACKEND=db pnpm dev
```

5. Start UI:

```bash
cd apps/ui
NEXT_PUBLIC_API_URL=http://localhost:8080 pnpm dev
```

## Tradeoffs & Design Decisions

### Why Metadata Separation?

**Pros:**

- Fast metadata queries without loading blob data
- Easy backend switching
- Can implement features like listing/searching without touching storage

**Cons:**

- Two writes per upload (metadata + storage)
- Potential consistency issues (mitigated by transactions in DB backend)

### Why SHA256 for Storage Keys?

**Pros:**

- Prevents path traversal attacks
- Consistent key format across backends
- Enables backend migration

**Cons:**

- Cannot derive original ID from storage key
- Requires metadata lookup to find blobs

### Why Manual S3 Signature V4?

**Pros:**

- No external dependencies
- Full control over signing process
- Works with any S3-compatible service

**Cons:**

- More complex implementation
- Must maintain compatibility with AWS spec

### Why Fastify over Express?

**Pros:**

- Better performance
- Built-in TypeScript support
- Modern async/await patterns

**Cons:**

- Smaller ecosystem than Express

## What Would I Do Next?

Given more time, I would:

1. **Add More Storage Backends**: Azure Blob Storage, Google Cloud Storage
2. **Implement Blob Listing**: GET /v1/blobs with pagination and filtering
3. **Add Blob Deletion**: DELETE /v1/blobs/:id endpoint
4. **Implement Versioning**: Support multiple versions of the same blob ID
5. **Add Compression**: Optional gzip compression for large blobs
6. **Implement Caching**: Redis cache for frequently accessed blobs
7. **Add Monitoring**: Prometheus metrics and structured logging
8. **Improve Error Messages**: More detailed error responses for debugging
9. **Add Rate Limiting**: Protect API from abuse
10. **Implement Webhooks**: Notify external services on blob events
11. **Add Multi-tenancy**: Support multiple users/organizations
12. **Implement Replication**: Replicate blobs across multiple backends for redundancy

## License

MIT
