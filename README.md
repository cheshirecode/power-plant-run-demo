# Power Plant Run

Static browser demo for a pixel-art soldier walking into a power plant with switchable visual styles.

Open `index.html` directly in a browser, or serve the folder with any static file server.

## Cloudflare

The deployed Worker serves the static demo and exposes the first multiplayer backend endpoints.

- Production: `https://power-plant-run-demo.cheshirecode.workers.dev`
- GitHub OAuth callback: `https://power-plant-run-demo.cheshirecode.workers.dev/api/auth/github/callback`
- Health check: `/api/health`
- OAuth config check: `/api/auth/config`
- Room creation: `POST /api/rooms`
- Room WebSocket: `/ws/rooms/:roomId?players=:targetCount`

Room creation and WebSocket joining require the signed GitHub session cookie. The
server derives the player identity from GitHub OAuth instead of trusting a client
provided player id.

## Room lifecycle notes

- Active players are assigned by GitHub identity, not by browser tab. If an active
  player disconnects during a round, their slot stays reserved and they can resume.
- The room directory is backed by a Durable Object, and each room persists its
  state to Durable Object storage. Do not rely on Worker module memory for
  recoverable room state.
- A player already assigned to a room should see Resume, not Watch. Watching your
  own active slot is intentionally blocked.
- If an owner disconnects during a game, ownership moves to a connected active
  player so the room can still be ended.
- Unexpected socket closes should return the client to the home/room-list screen
  instead of leaving it on a dead board.

Local commands:

```sh
npm install
npm run dev
npm run deploy
```

Runtime secrets are stored in Cloudflare, not in this repository:

```sh
printf '%s' "$POWER_PLANT_RUN_GITHUB_CLIENT_ID" | npx wrangler secret put GITHUB_CLIENT_ID
printf '%s' "$POWER_PLANT_RUN_GITHUB_CLIENT_SECRET" | npx wrangler secret put GITHUB_CLIENT_SECRET
```
