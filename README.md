# Bullet Hell Boss Rush

A 2D pixel-art boss rush with bullet-hell bosses, set in a tile-based world in the style of Terraria.
Go backend with SQLite, TypeScript + Canvas frontend.

## Running

Requires Go 1.22+ and Node 20+.

```sh
make run          # builds the frontend and server, then serves on http://localhost:8080
```

For development with hot reload, run the server and the Vite dev server side by side
(Vite proxies `/api` to the Go server):

```sh
go run ./cmd/server
make dev          # http://localhost:5173
```

Server flags: `-addr` (default `:8080`), `-db` (default `bullet-hell.db`), `-static` (default `web/dist`).

## Controls

| Action | Keys |
| ------ | ---- |
| Move   | A / D or arrow keys |
| Jump   | Space / W / Up (hold for a higher jump) |
| Attack | Left click (swings toward the cursor) or J; hold to auto-swing |
| Restart | R or Enter after a win or loss |

## Layout

- `cmd/server`: HTTP server that serves the built frontend and the JSON API
- `internal/store`: SQLite schema, boss roster seed data, run history
- `web/src`: the game
  - `sprites.ts`: all pixel art, defined as data and baked to canvases at startup
  - `world.ts`: tile map, collision, and the parallax background
  - `player.ts`: movement physics and the sword swing
  - `boss.ts`: boss AI and bullet patterns
  - `hud.ts`, `font.ts`: hearts, boss health bar, 5x7 bitmap font

## API

- `GET /api/bosses`: boss roster in fight order
- `GET /api/runs`: the 20 most recent runs
- `POST /api/runs`: record a run: `{ "bossId", "won", "durationMs", "heartsLeft" }`
