# Reading List

A small personal book-tracking web app. Add books, tag them, rate them, move
them through "to read", "reading", and "done", and filter the list by status.

The whole thing runs with one command and stores data in MongoDB that persists
across restarts.

## Stack

- Backend: Node.js with Express, plain JavaScript, no build step.
- Database: MongoDB 7, accessed with the official `mongodb` driver.
- Frontend: a single static HTML page with vanilla JS and CSS, served by the
  Express app on the same port.

## Requirements

- Docker and the Docker Compose plugin.

That is all. Node and MongoDB run inside containers, so you do not need them
installed on the host.

## Run it

From the repository root:

```bash
docker compose up --build
```

Then open http://localhost:8080 in your browser.

The first boot builds the app image, starts MongoDB, waits for the database
healthcheck to pass, and only then starts the app. You will see a
`Connected to MongoDB` line in the logs once it is ready.

To stop it, press Ctrl+C, or run:

```bash
docker compose down
```

Your data lives in a named Docker volume (`mongo_data`), so it survives
`docker compose down` and container restarts. To wipe the data as well:

```bash
docker compose down -v
```

## Configuration

Configuration is read from environment variables. Compose provides sensible
defaults, so `docker compose up --build` works with no setup. To customize,
copy the example file and edit it:

```bash
cp .env.example .env
```

| Variable                      | Used by | Purpose                                           |
| ----------------------------- | ------- | ------------------------------------------------- |
| `MONGO_INITDB_ROOT_USERNAME`  | db      | MongoDB root username created on first boot.      |
| `MONGO_INITDB_ROOT_PASSWORD`  | db      | MongoDB root password created on first boot.      |
| `MONGO_URL`                   | app     | Full MongoDB connection string.                   |
| `MONGO_DB`                    | app     | Database name the app stores books in.            |
| `PORT`                        | app     | Port the Express app listens on (default 8080).   |

Credentials are never hardcoded in the source. The app reads the full
connection string and database name from the environment.

## API

Base path: `/api/books`. All request and response bodies are JSON.

| Method | Path              | Description                                  |
| ------ | ----------------- | -------------------------------------------- |
| GET    | `/api/books`      | List books. Optional `?status=` filter.      |
| POST   | `/api/books`      | Create a book.                               |
| GET    | `/api/books/:id`  | Fetch a single book.                         |
| PUT    | `/api/books/:id`  | Update a book (partial updates allowed).     |
| DELETE | `/api/books/:id`  | Delete a book.                               |
| GET    | `/healthz`        | Returns 200 with JSON once Mongo is reachable. |

### Book shape

```json
{
  "_id": "665f1c...",
  "title": "The Left Hand of Darkness",
  "author": "Ursula K. Le Guin",
  "status": "reading",
  "rating": 5,
  "tags": ["fiction", "sci-fi"],
  "created_at": "2026-08-08T12:00:00.000Z",
  "updated_at": "2026-08-08T12:00:00.000Z"
}
```

- `status` is one of `to-read`, `reading`, `done`.
- `rating` is an integer from 0 to 5, or `null`.
- `tags` is an array of strings.

### Example requests

Create a book:

```bash
curl -X POST http://localhost:8080/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","status":"to-read","tags":["sci-fi"]}'
```

List only books you are currently reading:

```bash
curl "http://localhost:8080/api/books?status=reading"
```

## How it fits together

- On boot the app retries the MongoDB connection with exponential backoff until
  the database is ready, then creates an index on `status` (idempotent) and
  starts serving.
- Express serves the static UI from `public/` and the REST API under `/api`.
- The compose `app` service waits for the `db` healthcheck to pass before
  starting, and the app's own retry loop covers any remaining startup gap.

## Project layout

```
.
├── src/
│   ├── server.js   Express app, static hosting, health check, startup
│   ├── db.js       Mongo connection with backoff, index creation, ping
│   └── books.js    Books router, validation, CRUD handlers
├── public/
│   ├── index.html  Single-page UI
│   ├── styles.css  Styling
│   └── app.js      Vanilla JS client
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
└── README.md
```
