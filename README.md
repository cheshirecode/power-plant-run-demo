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
