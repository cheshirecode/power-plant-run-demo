export function normalizeRoomId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

export function getRoomIdFromUrl(location = window.location) {
  return normalizeRoomId(new URLSearchParams(location.search).get("room") || "");
}

export function updateRoomUrl(roomId, history = window.history, href = window.location.href) {
  const url = new URL(href);
  url.searchParams.set("room", roomId);
  history.replaceState({}, "", url);
}

export function clearRoomUrl(history = window.history, href = window.location.href) {
  const url = new URL(href);
  url.searchParams.delete("room");
  history.replaceState({}, "", url);
}

export function buildRoomUrl(roomId, href = window.location.href) {
  const url = new URL(href);
  url.searchParams.set("room", roomId);
  return url.toString();
}
