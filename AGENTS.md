# AGENTS.md

Scope: this file governs work in `cheshirecode/power-plant-run-demo`.

## Project

Power Plant Run is a browser canvas game deployed as a Cloudflare Worker with Durable Objects.

- Production URL: `https://power-plant-run-demo.cheshirecode.workers.dev`
- GitHub repo: `cheshirecode/power-plant-run-demo`
- Main worker: `src/worker.js`
- Frontend entry: `index.html`, `main.js`, `styles.css`, and helpers in `client/`
- Product/design context: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`

## Local Tooling

- Use the user's shell environment for Node tooling:
  `source ~/.zshrc >/dev/null 2>&1; <command>`
- Validate JavaScript with:
  `node --check main.js && node --check client/formatters.js && node --check client/room-url.js && node --check src/worker.js`
- Validate Cloudflare packaging with:
  `npm run deploy -- --dry-run`
- Run locally with:
  `npm run dev -- --port 8799 --ip 127.0.0.1`

## Git And Deploy

This repo lives under `/Users/fredtran/Documents/oss`, where commits and pushes should use the `cheshirecode` identity.

Before committing, pushing, or deploying from this checkout, verify/source the OSS user switch:

```bash
source /Users/fredtran/Documents/oss/.envrc
git config user.name
git config user.email
gh auth status
```

Deploy with `npm run deploy` after checks pass. Never commit secrets, `.dev.vars`, generated image references, or `.wrangler/` state.

## Multiplayer Flow Invariants

- GitHub OAuth is identity only: use `id`, `login`, and `avatar_url`; do not request repo scopes.
- Rooms are Cloudflare Durable Objects and remain in memory for the MVP.
- A room has 1-4 active player slots; extra joiners are spectators.
- Spectators can watch but cannot ready, move, claim nodes, or affect scores.
- Lobby starts only when all active players are present and ready.
- Repair nodes use claim-and-hold mechanics; timer top-up happens only after the hold completes.
- Countdown reaching zero must always advance to explosion and then `end`.
- Ended rooms show score summary and replay controls, not the live board.
- Room owners can close the room; all clients should return to the starting screen.
- Active room membership is identity-scoped, not socket-scoped. If an active player disconnects after the game starts, keep their slot and mark them disconnected so they can resume.
- Never let the same GitHub user watch their own active slot. Directory rows should show Resume for rooms where `viewerRole` is `active` or `spectator`.
- The room directory must be durable. Do not use module-level memory for discoverable room IDs; Worker isolates can reload while Durable Objects keep room state.
- Room-list reads are best-effort. One bad/stale room summary must not make `/api/rooms` return 500 or blank the client UI.
- Do not force-close sockets immediately after broadcasting `room:closed`; clients should receive the closed state and navigate home themselves.
