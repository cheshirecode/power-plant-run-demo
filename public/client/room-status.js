import { countdownLabel } from "./formatters.js";

export function buildRoomStatusText(roomId, room, selectedRoomSize, now = Date.now()) {
  if (!roomId) return "";
  const players = Object.values(room?.players || {});
  const activeCount = players.filter((player) => !player.spectator && !player.bot).length;
  const botCount = players.filter((player) => !player.spectator && player.bot).length;
  const spectatorCount = players.filter((player) => player.spectator).length;
  const targetCount = room?.targetPlayerCount || selectedRoomSize;
  const phase = room?.phase || "room";
  const suffix = phase === "repair" ? ` · ${countdownLabel(room, now)}s` : "";
  const bots = botCount > 0 ? ` + ${botCount} bot` : "";
  const spectators = spectatorCount > 0 ? ` · ${spectatorCount} watching` : "";
  return `${roomId} · ${activeCount}/${targetCount}${bots}${spectators} · ${phase}${suffix}`;
}
