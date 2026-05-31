import { buildRoomStatusText } from "../public/client/room-status.js";

const now = Date.now();
const room = {
  phase: "repair",
  targetPlayerCount: 2,
  countdownEndsAt: now + 10_000,
  players: {
    alice: { id: "alice", spectator: false },
    bot: { id: "bot", spectator: false, bot: true },
    watcher: { id: "watcher", spectator: true },
  },
};

const first = buildRoomStatusText("timer", room, 4, now);
const second = buildRoomStatusText("timer", room, 4, now + 1230);
assert(first.includes("10.00s"), `initial countdown missing: ${first}`);
assert(second.includes("8.77s"), `countdown did not tick from current time: ${second}`);
assert(first !== second, "room status countdown did not change across time");

const ended = buildRoomStatusText("timer", { ...room, phase: "end" }, 4, now + 1230);
assert(!ended.includes("s"), `ended room should not show countdown suffix: ${ended}`);

console.log("countdown ui smoke passed");

function assert(value, message) {
  if (!value) throw new Error(message);
}
