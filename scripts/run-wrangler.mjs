import { spawn } from "node:child_process";

const CLOUDFLARE_ACCOUNT_ID = "dbc043b6d90de37f63b518dc38b2bed8";

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required. Export it in your shell before running Wrangler commands.");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-wrangler.mjs <wrangler-args...>");
  process.exit(1);
}

const child = spawn("wrangler", args, {
  env: {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID,
  },
  shell: false,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
