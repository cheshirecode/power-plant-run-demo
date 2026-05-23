export function countdownMs(room, now = Date.now()) {
  if (!room?.countdownEndsAt) return 0;
  return Math.max(0, room.countdownEndsAt - now);
}

export function countdownSeconds(room, now = Date.now()) {
  return Math.ceil(countdownMs(room, now) / 1000);
}

export function countdownLabel(room, now = Date.now()) {
  return (countdownMs(room, now) / 1000).toFixed(2);
}

export function formatScore(value) {
  return Number(value || 0).toFixed(2);
}

export function formatNodeValue(value) {
  return Number(value || 0).toFixed(2);
}

export function formatHoldLabel(ms) {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}
