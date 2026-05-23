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
- Room WebSocket: `/ws/rooms/:roomId?players=:targetCount&bot=1`
- Room/session close: `DELETE /api/rooms/:roomId`

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
- Rooms can include one server-controlled bot. The bot is not counted against
  human player slots, is always ready, chases useful nodes, and retreats when
  the countdown is nearly spent.
- Scores are split into banked total score and current round score. Explosion
  only wipes the current round score; surviving players bank their current round
  score into their total when the summary is created.
- Player state is currently a tiny FSM: `alive` at round start, then
  `incapacitated` if caught in the explosion.
- A room can run multiple games through the New game vote. End session closes
  the room and removes it from the public room list.

Local commands:

```sh
npm install
npm run dev
npm run smoke:demo
npm run smoke:bots
npm run deploy
```

`npm run smoke:demo` loads the browser demo scene with canvas/DOM stubs and
checks the actual demo mechanics: eight players, 20 starting nodes, claim/repair
progress, timer deltas, stasis freezes, visible rebuild timing, short vortex
handoff, and demo-only skills staying out of server gameplay.

`npm run smoke:bots` expects a running Worker at `POWER_PLANT_RUN_SMOKE_URL`
or `http://127.0.0.1:8787`. It creates 2, 3, and 4 player bot rooms, verifies
the bot joins and moves, then deletes every smoke room it created.

Runtime secrets are stored in Cloudflare, not in this repository:

```sh
printf '%s' "$POWER_PLANT_RUN_GITHUB_CLIENT_ID" | npx wrangler secret put GITHUB_CLIENT_ID
printf '%s' "$POWER_PLANT_RUN_GITHUB_CLIENT_SECRET" | npx wrangler secret put GITHUB_CLIENT_SECRET
```
