export const PLAYER_STATES = {
  alive: "alive",
  incapacitated: "incapacitated",
  stasis: "stasis",
};

export const NODE_STATES = {
  unclaimed: "unclaimed",
  claimed: "claimed",
  repaired: "repaired",
  stasis: "stasis",
};

export const SKILL_IDS = {
  boost: "boost",
  magnet: "magnet",
  stasis: "stasis",
  warp: "warp",
  greed: "greed",
};

export const SKILL_CONFIG = {
  boost: {
    activeMs: 1000,
    cooldownMs: 3000,
    speedMultiplier: 2,
  },
  magnet: {
    claimRadius: 72,
    captureMultiplier: 0.36,
    scoreMultiplier: 1.35,
  },
  stasis: {
    cooldownMs: 2600,
    pulseMs: 300,
    freezeMs: 1150,
    radius: 160,
    captureMultiplier: 0.42,
    scoreMultiplier: 1.35,
  },
  warp: {
    cooldownMs: 1700,
    activeMs: 360,
    teleportRange: 130,
    captureMultiplier: 0.54,
    scoreMultiplier: 1.08,
  },
  greed: {
    highValueMin: 7,
    lowValueHoldMultiplier: 0.5,
    highValueHoldMultiplier: 1,
    lowValueScoreMultiplier: 0.75,
    highValueScoreMultiplier: 1.25,
  },
};

export function distance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

export function isHighValueNode(node, config = SKILL_CONFIG) {
  return Math.abs(node?.value || 0) >= config.greed.highValueMin || Boolean(node?.bonus);
}

export function getBoostIntervalMs(config = SKILL_CONFIG) {
  return config.boost.activeMs + config.boost.cooldownMs;
}

export function isBoostActive(elapsed, config = SKILL_CONFIG) {
  return elapsed % getBoostIntervalMs(config) < config.boost.activeMs;
}

export function getSkillCooldownRatio(skillId, elapsed, config = SKILL_CONFIG) {
  if (skillId === SKILL_IDS.stasis) {
    return 1 - (elapsed % config.stasis.cooldownMs) / config.stasis.cooldownMs;
  }
  if (skillId === SKILL_IDS.boost) {
    const phase = elapsed % getBoostIntervalMs(config);
    if (phase < config.boost.activeMs) return 1;
    return 1 - (phase - config.boost.activeMs) / config.boost.cooldownMs;
  }
  if (skillId === SKILL_IDS.warp) {
    const phase = elapsed % config.warp.cooldownMs;
    if (phase < config.warp.activeMs) return 1;
    return 1 - (phase - config.warp.activeMs) / (config.warp.cooldownMs - config.warp.activeMs);
  }
  return null;
}

export function getCaptureDurationMs(node, skillId, config = SKILL_CONFIG) {
  const baseHoldMs = node?.holdMs || 0;
  if (skillId === SKILL_IDS.greed) {
    const multiplier = isHighValueNode(node, config) ? config.greed.highValueHoldMultiplier : config.greed.lowValueHoldMultiplier;
    return Math.max(1150, Math.round(baseHoldMs * multiplier));
  }
  if (skillId === SKILL_IDS.magnet) {
    return Math.max(1150, Math.round(baseHoldMs * config.magnet.captureMultiplier));
  }
  if (skillId === SKILL_IDS.stasis) {
    return Math.max(1150, Math.round(baseHoldMs * config.stasis.captureMultiplier));
  }
  if (skillId === SKILL_IDS.warp) {
    return Math.max(1150, Math.round(baseHoldMs * config.warp.captureMultiplier));
  }
  return Math.max(1150, Math.round(baseHoldMs * 0.68));
}

export function getNodeScoreValue(node, skillId, config = SKILL_CONFIG) {
  let multiplier = 1;
  if (skillId === SKILL_IDS.greed) {
    multiplier = isHighValueNode(node, config) ? config.greed.highValueScoreMultiplier : config.greed.lowValueScoreMultiplier;
  } else if (skillId === SKILL_IDS.magnet) {
    multiplier = config.magnet.scoreMultiplier;
  } else if (skillId === SKILL_IDS.stasis) {
    multiplier = config.stasis.scoreMultiplier;
  } else if (skillId === SKILL_IDS.warp) {
    multiplier = config.warp.scoreMultiplier;
  }
  return Math.abs(node?.value || 0) * multiplier;
}

export function isStasisPulseActive(elapsed, config = SKILL_CONFIG) {
  return elapsed % config.stasis.cooldownMs < config.stasis.freezeMs;
}

export function isPointInStasis(point, sources, config = SKILL_CONFIG) {
  return sources.some((source) => distance(point, source) <= config.stasis.radius);
}

export function isNodeInStasis(node, sources, config = SKILL_CONFIG) {
  return isPointInStasis(node, sources, config);
}

export function canPlayerClaimDuringStasis(actor) {
  return actor?.ability?.id === SKILL_IDS.stasis;
}

export function canSkillClaimNode(actor, node, config = SKILL_CONFIG) {
  if (!actor || !node || actor.phase === PLAYER_STATES.stasis) return false;
  if (actor.ability?.id === SKILL_IDS.magnet) return distance(actor, node) <= config.magnet.claimRadius;

  const nodeHalf = (node.size || 8) / 2;
  const actorHalfWidth = 7;
  const actorHalfHeight = 10;
  return Math.abs(actor.x - node.x) <= nodeHalf + actorHalfWidth && Math.abs(actor.y - node.y) <= nodeHalf + actorHalfHeight;
}

export function findBestWarpNode(position, nodes, config = SKILL_CONFIG) {
  return nodes
    .filter((node) => !node.repaired && distance(position, node) <= config.warp.teleportRange)
    .map((node) => ({
      node,
      score: Math.abs(node.value || 0) * 100 + (isHighValueNode(node, config) ? 80 : 0) - distance(position, node),
    }))
    .sort((a, b) => b.score - a.score)[0]?.node || null;
}
