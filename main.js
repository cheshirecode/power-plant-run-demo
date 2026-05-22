const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const shell = document.querySelector(".demo-shell");
const statusText = document.querySelector("#run-status");
const replayButton = document.querySelector("#replay-button");
const styleButtons = [...document.querySelectorAll(".style-button")];

const VIEW = {
  width: canvas.width,
  height: canvas.height,
};

const styles = {
  steampunk: {
    name: "Steampunk",
    image: "assets/steampunk-reference.png",
    crop: { sx: 245, sy: 155, sw: 820, sh: 710 },
    entrance: { x: 202, y: 137 },
    css: {
      page: "#11140f",
      panel: "#1b1a14",
      strong: "#2a2619",
      text: "#f1e8cf",
      muted: "#bca982",
      accent: "#d5983b",
      accent2: "#70a8ff",
      border: "#4a3b21",
    },
    scene: {
      sky: "#152213",
      ground: "#4c6424",
      groundDark: "#324516",
      groundLight: "#6f8332",
      path: "#a07845",
      pathDark: "#5f4728",
      rock: "#8a8977",
      accent: "#d89a43",
      glow: "#7eb4ff",
      shadow: "rgba(18, 12, 5, 0.48)",
      soldier: {
        armor: "#5a4631",
        armorLight: "#a28358",
        visor: "#e0432f",
        weapon: "#24221d",
        boot: "#17140f",
      },
    },
  },
  cyberpunk: {
    name: "Cyberpunk",
    image: "assets/cyberpunk-reference.png",
    crop: { sx: 38, sy: 62, sw: 516, sh: 432 },
    entrance: { x: 198, y: 138 },
    css: {
      page: "#071018",
      panel: "#0b1421",
      strong: "#15112a",
      text: "#eaf7ff",
      muted: "#80b6c9",
      accent: "#ff3cd9",
      accent2: "#18d8ff",
      border: "#1d5d74",
    },
    scene: {
      sky: "#07131b",
      ground: "#22312a",
      groundDark: "#111d1c",
      groundLight: "#37534a",
      path: "#3a3f51",
      pathDark: "#242634",
      rock: "#5f7580",
      accent: "#ff3bd9",
      glow: "#0fdcff",
      shadow: "rgba(0, 0, 0, 0.58)",
      soldier: {
        armor: "#16202e",
        armorLight: "#2ddfff",
        visor: "#ff41db",
        weapon: "#f5f9ff",
        boot: "#06080f",
      },
    },
  },
  futuristic: {
    name: "Futuristic",
    image: "assets/futuristic-reference.png",
    crop: { sx: 70, sy: 58, sw: 472, sh: 382 },
    entrance: { x: 200, y: 139 },
    css: {
      page: "#0c1418",
      panel: "#111a1f",
      strong: "#1d2c32",
      text: "#edf7fb",
      muted: "#94afba",
      accent: "#2ebcff",
      accent2: "#b7d9f4",
      border: "#456777",
    },
    scene: {
      sky: "#102025",
      ground: "#536725",
      groundDark: "#35451a",
      groundLight: "#758a35",
      path: "#a8955f",
      pathDark: "#665738",
      rock: "#aab4b8",
      accent: "#2abfff",
      glow: "#9fdfff",
      shadow: "rgba(4, 12, 16, 0.42)",
      soldier: {
        armor: "#d9e3e7",
        armorLight: "#63caff",
        visor: "#2cbcff",
        weapon: "#27333a",
        boot: "#57666d",
      },
    },
  },
};

const plantRect = { x: 148, y: 20, w: 188, h: 154 };
const plantPalettes = {
  steampunk: {
    body: "#66523a",
    bodyLight: "#b58a4b",
    bodyDark: "#241a12",
    trim: "#d49a42",
    trimDark: "#7c4f24",
    roof: "#a73324",
    roofLight: "#d65d32",
    pipe: "#9d6d34",
    pipeDark: "#4d311b",
    core: "#71a8ff",
    coreDark: "#254f95",
    coreBright: "#f0f8ff",
    panel: "#18375f",
    door: "#1d1712",
  },
  cyberpunk: {
    body: "#171b28",
    bodyLight: "#2d3552",
    bodyDark: "#05070d",
    trim: "#10d9ff",
    trimDark: "#0a647e",
    roof: "#ff35d6",
    roofLight: "#ff7aea",
    pipe: "#7e2a9b",
    pipeDark: "#22112f",
    core: "#70c6ff",
    coreDark: "#154c99",
    coreBright: "#f2fbff",
    panel: "#ff31d2",
    door: "#06080d",
  },
  futuristic: {
    body: "#c6d4d9",
    bodyLight: "#eef7fb",
    bodyDark: "#42545b",
    trim: "#2abfff",
    trimDark: "#176184",
    roof: "#e8f0f3",
    roofLight: "#ffffff",
    pipe: "#8e9da3",
    pipeDark: "#45545b",
    core: "#83cdff",
    coreDark: "#2774b8",
    coreBright: "#f7fcff",
    panel: "#24aef4",
    door: "#162229",
  },
};

const walkPath = [
  { x: 34, y: 178 },
  { x: 74, y: 166 },
  { x: 116, y: 149 },
  { x: 157, y: 131 },
  { x: 194, y: 121 },
  { x: 203, y: 134 },
];

let activeStyle = "steampunk";
let startedAt = performance.now();
let lastStatus = "";
const loadedSprites = {};
const loadedTerrains = {};

ctx.imageSmoothingEnabled = false;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

async function loadReferences() {
  const entries = await Promise.all(
    Object.entries(styles).map(async ([key, style]) => {
      const image = await loadImage(style.image);
      return [
        key,
        {
          sprite: makeTransparentPlantSprite(image, style.crop, key),
          terrain: makeReferenceTerrain(image, key),
        },
      ];
    }),
  );

  for (const [key, assets] of entries) {
    loadedSprites[key] = assets.sprite;
    loadedTerrains[key] = assets.terrain;
  }
}

function makeReferenceTerrain(image, styleKey) {
  const terrainCanvas = document.createElement("canvas");
  terrainCanvas.width = VIEW.width;
  terrainCanvas.height = VIEW.height;

  const terrainCtx = terrainCanvas.getContext("2d", { willReadFrequently: true });
  terrainCtx.imageSmoothingEnabled = false;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;

  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.drawImage(image, 0, 0);

  const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const palette = extractGroundPalette(sourceData, styleKey);
  const destination = terrainCtx.createImageData(VIEW.width, VIEW.height);

  for (let y = 0; y < VIEW.height; y += 2) {
    for (let x = 0; x < VIEW.width; x += 2) {
      const color = chooseGroundColor(palette, x, y, styleKey);
      paintBlock(destination, x, y, 2, color);
    }
  }

  terrainCtx.putImageData(destination, 0, 0);
  addReferenceGrassDetails(terrainCtx, palette, styleKey);
  return terrainCanvas;
}

function extractGroundPalette(sourceData, styleKey) {
  const { data, width, height } = sourceData;
  const buckets = new Map();

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (!isGrassLikePixel(r, g, b, a, styleKey)) continue;

      const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
  }

  const palette = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 42)
    .map((bucket) => ({
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
    }))
    .sort((a, b) => luminance(a) - luminance(b));

  if (palette.length >= 8) return palette;

  const colors = styles[styleKey].scene;
  return [colors.groundDark, colors.ground, colors.groundLight].map(hexToRgb);
}

function chooseGroundColor(palette, x, y, styleKey) {
  const fine = hash2d(Math.floor(x / 2), Math.floor(y / 2), styleKey.length + 19);
  const diagonal = hash2d(Math.floor((x + y) / 22), Math.floor((x - y + VIEW.width) / 22), styleKey.length + 41);
  const fleck = hash2d(x + 5, y + 11, styleKey.length + 73);
  const mixed = fine * 0.58 + diagonal * 0.28 + fleck * 0.14;
  const index = Math.floor((0.14 + mixed * 0.72) * palette.length);
  return palette[clamp(index, 0, palette.length - 1)];
}

function paintBlock(imageData, x, y, size, color) {
  for (let yy = 0; yy < size; yy += 1) {
    if (y + yy >= imageData.height) continue;

    for (let xx = 0; xx < size; xx += 1) {
      if (x + xx >= imageData.width) continue;

      const offset = ((y + yy) * imageData.width + x + xx) * 4;
      imageData.data[offset] = color.r;
      imageData.data[offset + 1] = color.g;
      imageData.data[offset + 2] = color.b;
      imageData.data[offset + 3] = 255;
    }
  }
}

function addReferenceGrassDetails(terrainCtx, palette, styleKey) {
  for (let i = 0; i < 120; i += 1) {
    const x = Math.floor(hash2d(i, 7, styleKey.length) * VIEW.width);
    const y = Math.floor(20 + hash2d(i, 17, styleKey.length) * (VIEW.height - 28));
    const dark = palette[Math.floor(hash2d(i, 23, styleKey.length) * Math.max(1, palette.length * 0.35))];
    const light = palette[Math.floor(palette.length * 0.58 + hash2d(i, 31, styleKey.length) * Math.max(1, palette.length * 0.28))];

    terrainCtx.fillStyle = rgbToCss(dark);
    terrainCtx.fillRect(x, y, 2, 8);
    terrainCtx.fillRect(x + 4, y + 3, 2, 5);
    terrainCtx.fillStyle = rgbToCss(light);
    terrainCtx.fillRect(x + 1, y + 5, 8, 2);
  }
}

function isGrassLikePixel(r, g, b, a, styleKey) {
  if (a < 8) return false;

  if (styleKey === "cyberpunk") {
    return g > 30 && b > 24 && r < 92 && g >= r + 5 && b >= r + 2 && !(b > 130 && g > 90);
  }

  return g > 48 && g >= r + 4 && g >= b + 14 && b < 126 && r < 140;
}

function luminance(color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function rgbToCss(color) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function makeTransparentPlantSprite(image, crop, styleKey) {
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = crop.sw;
  spriteCanvas.height = crop.sh;

  const spriteCtx = spriteCanvas.getContext("2d", { willReadFrequently: true });
  spriteCtx.imageSmoothingEnabled = false;
  spriteCtx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

  const imageData = spriteCtx.getImageData(0, 0, crop.sw, crop.sh);
  const { data } = imageData;
  const total = crop.sw * crop.sh;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  function enqueueIfBackground(x, y) {
    if (x < 0 || y < 0 || x >= crop.sw || y >= crop.sh) return;
    const index = y * crop.sw + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (!isTerrainPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3], styleKey)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  for (let x = 0; x < crop.sw; x += 1) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, crop.sh - 1);
  }

  for (let y = 0; y < crop.sh; y += 1) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(crop.sw - 1, y);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % crop.sw;
    const y = Math.floor(index / crop.sw);
    enqueueIfBackground(x + 1, y);
    enqueueIfBackground(x - 1, y);
    enqueueIfBackground(x, y + 1);
    enqueueIfBackground(x, y - 1);
  }

  for (let index = 0; index < total; index += 1) {
    if (!visited[index]) continue;
    const offset = index * 4;
    data[offset + 3] = 0;
  }

  spriteCtx.putImageData(imageData, 0, 0);
  return spriteCanvas;
}

function isTerrainPixel(r, g, b, a, styleKey) {
  if (a < 8) return true;

  const greenGrass = g > 42 && g > r * 1.06 && g > b * 1.2 && g - b > 16;
  const oliveGrass = g > 52 && r > 28 && b < 95 && g >= r && r >= b && g - b > 18;
  const darkCyberGrass = styleKey === "cyberpunk" && g > 36 && b > 28 && r < 65 && g >= r && b >= r;
  const dirtPath = r > 74 && g > 50 && b < 82 && r >= g && r - b > 24 && Math.abs(r - g) < 72;
  const paleStone = r > 112 && g > 108 && b > 92 && Math.abs(r - g) < 28 && Math.abs(g - b) < 36;

  return greenGrass || oliveGrass || darkCyberGrass || dirtPath || paleStone;
}

function setCssVars(style) {
  const root = document.documentElement;
  root.style.setProperty("--page-bg", style.css.page);
  root.style.setProperty("--panel-bg", style.css.panel);
  root.style.setProperty("--panel-strong", style.css.strong);
  root.style.setProperty("--text", style.css.text);
  root.style.setProperty("--muted", style.css.muted);
  root.style.setProperty("--accent", style.css.accent);
  root.style.setProperty("--accent-2", style.css.accent2);
  root.style.setProperty("--border", style.css.border);
}

function setActiveStyle(nextStyle) {
  activeStyle = nextStyle;
  const style = styles[activeStyle];
  shell.dataset.style = activeStyle;
  setCssVars(style);

  for (const button of styleButtons) {
    const isActive = button.dataset.style === activeStyle;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function replay() {
  startedAt = performance.now();
  lastStatus = "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function getPointOnPath(points, progress) {
  const clamped = clamp(progress, 0, 1);
  const segment = Math.min(points.length - 2, Math.floor(clamped * (points.length - 1)));
  const local = clamped * (points.length - 1) - segment;
  const current = points[segment];
  const next = points[segment + 1];

  return {
    x: lerp(current.x, next.x, local),
    y: lerp(current.y, next.y, local),
  };
}

function hash2d(x, y, seed = 0) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.17) * 43758.5453;
  return value - Math.floor(value);
}

function setStatus(progress) {
  let next = "Approaching the plant";
  if (progress > 0.74) next = "Entering the plant";
  if (progress >= 0.98) next = "Inside the power plant";

  if (next !== lastStatus) {
    statusText.textContent = next;
    lastStatus = next;
  }
}

function drawBackground(style, time) {
  const colors = style.scene;
  const terrain = loadedTerrains[activeStyle];

  ctx.fillStyle = colors.sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  if (terrain) {
    ctx.drawImage(terrain, 0, 16, VIEW.width, VIEW.height - 16, 0, 16, VIEW.width, VIEW.height - 16);
    drawPath(colors);
    drawAmbientEffects(colors, time);
    return;
  }

  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 16, VIEW.width, VIEW.height);

  for (let y = 16; y < VIEW.height; y += 4) {
    for (let x = 0; x < VIEW.width; x += 4) {
      const n = hash2d(x, y, activeStyle.length);
      if (n > 0.72) {
        ctx.fillStyle = n > 0.9 ? colors.groundLight : colors.groundDark;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  drawPath(colors);
  drawIsometricLines(colors);
  drawTerrainDetails(colors, time);
}

function drawPath(colors) {
  ctx.fillStyle = colors.pathDark;
  ctx.beginPath();
  ctx.moveTo(0, 193);
  ctx.lineTo(55, 170);
  ctx.lineTo(112, 148);
  ctx.lineTo(169, 127);
  ctx.lineTo(205, 118);
  ctx.lineTo(218, 137);
  ctx.lineTo(169, 154);
  ctx.lineTo(104, 174);
  ctx.lineTo(40, 198);
  ctx.lineTo(0, 209);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.path;
  ctx.beginPath();
  ctx.moveTo(0, 197);
  ctx.lineTo(57, 174);
  ctx.lineTo(116, 153);
  ctx.lineTo(174, 133);
  ctx.lineTo(202, 126);
  ctx.lineTo(211, 137);
  ctx.lineTo(162, 151);
  ctx.lineTo(103, 170);
  ctx.lineTo(38, 193);
  ctx.lineTo(0, 204);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#fff8c9";
  for (let i = 0; i < 28; i += 1) {
    const p = getPointOnPath(walkPath, i / 28);
    const jitter = hash2d(i, i + 3) * 10 - 5;
    ctx.fillRect(Math.round(p.x + jitter), Math.round(p.y + 4), 5, 2);
  }
  ctx.globalAlpha = 1;
}

function drawIsometricLines(colors) {
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = colors.groundLight;
  ctx.lineWidth = 1;
  for (let x = -VIEW.height; x < VIEW.width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x + VIEW.height, VIEW.height);
    ctx.stroke();
  }
  for (let x = 0; x < VIEW.width + VIEW.height; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x - VIEW.height, VIEW.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTerrainDetails(colors, time) {
  for (let i = 0; i < 70; i += 1) {
    const x = Math.round(hash2d(i, 8) * VIEW.width);
    const y = Math.round(24 + hash2d(i, 19) * (VIEW.height - 36));

    if (x > 130 && x < 340 && y > 14 && y < 178) continue;
    if (hash2d(i, 31) > 0.68) {
      drawGrass(x, y, colors);
    } else {
      drawRock(x, y, colors);
    }
  }

  drawAmbientEffects(colors, time);
}

function drawAmbientEffects(colors, time) {
  if (activeStyle === "cyberpunk") {
    drawRain(colors, time);
    drawPuddles(colors, time);
  } else if (activeStyle === "steampunk") {
    drawSteamPuffs(colors, time);
  } else {
    drawFutureMarkers(colors, time);
  }
}

function drawGrass(x, y, colors) {
  ctx.fillStyle = colors.groundDark;
  ctx.fillRect(x, y, 2, 8);
  ctx.fillRect(x + 3, y + 2, 2, 6);
  ctx.fillStyle = colors.groundLight;
  ctx.fillRect(x + 1, y + 4, 8, 2);
  ctx.fillRect(x - 3, y + 6, 6, 2);
}

function drawRock(x, y, colors) {
  ctx.fillStyle = colors.rock;
  ctx.fillRect(x, y, 6, 3);
  ctx.fillRect(x + 1, y - 2, 4, 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(x + 1, y + 3, 6, 1);
}

function drawRain(colors, time) {
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = 1;
  for (let i = 0; i < 44; i += 1) {
    const x = (hash2d(i, 51) * VIEW.width + time * 0.036 + i * 7) % VIEW.width;
    const y = (hash2d(i, 93) * VIEW.height + time * 0.18) % VIEW.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPuddles(colors, time) {
  const pulse = 0.45 + Math.sin(time / 240) * 0.12;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = colors.glow;
  ctx.fillRect(30, 152, 18, 3);
  ctx.fillRect(278, 176, 22, 3);
  ctx.fillRect(96, 122, 15, 2);
  ctx.globalAlpha = 1;
}

function drawSteamPuffs(colors, time) {
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = "#f3e6c8";
  for (let i = 0; i < 4; i += 1) {
    const drift = (time / 80 + i * 11) % 24;
    ctx.fillRect(274 + i * 4, 25 - drift, 8, 5);
    ctx.fillRect(280 + i * 3, 20 - drift, 6, 4);
  }
  ctx.globalAlpha = 1;
}

function drawFutureMarkers(colors, time) {
  const pulse = Math.sin(time / 210) > 0 ? 1 : 0.5;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = 1;
  for (const marker of [
    { x: 60, y: 124 },
    { x: 306, y: 168 },
    { x: 116, y: 84 },
  ]) {
    ctx.strokeRect(marker.x, marker.y, 9, 5);
    ctx.fillStyle = colors.glow;
    ctx.fillRect(marker.x + 3, marker.y + 2, 3, 1);
  }
  ctx.globalAlpha = 1;
}

function px(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawPixelLine(x0, y0, x1, y1, width, color) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;
  const offset = Math.floor(width / 2);

  while (true) {
    px(x - offset, y - offset, width, width, color);
    if (x === endX && y === endY) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawPipe(points, width, fill, shadow) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    drawPixelLine(start.x, start.y, end.x, end.y, width + 2, shadow);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    drawPixelLine(start.x, start.y, end.x, end.y, width, fill);
  }
}

function drawPixelCircle(cx, cy, radius, fill, edge) {
  if (edge) {
    drawPixelCircle(cx, cy, radius + 2, edge);
  }

  for (let y = -radius; y <= radius; y += 2) {
    const halfWidth = Math.floor(Math.sqrt(radius * radius - y * y));
    px(cx - halfWidth, cy + y, halfWidth * 2, 2, fill);
  }
}

function drawPlant(style, time, progress) {
  const colors = style.scene;
  const palette = plantPalettes[activeStyle];
  const sprite = loadedSprites[activeStyle];

  if (!sprite) {
    drawNativePlant(style, time, progress);
    return;
  }

  drawPlantShadow(colors);
  drawGroundContact(colors);
  ctx.drawImage(sprite, plantRect.x, plantRect.y, plantRect.w, plantRect.h);
  drawEntrance(style, palette, progress, time);
}

function drawGroundContact(colors) {
  ctx.globalAlpha = 0.55;
  px(174, 132, 128, 5, colors.shadow);
  px(191, 141, 78, 4, colors.shadow);
  ctx.globalAlpha = 1;
}

function drawNativePlant(style, time, progress) {
  const colors = style.scene;
  const palette = plantPalettes[activeStyle];

  drawPlantShadow(colors);
  drawPlantPad(colors, palette);
  drawPlantBackPipes(palette);
  drawPlantTowers(palette);
  drawCorePedestal(palette);
  drawCoreOrb(palette, time);
  drawPlantFrontDetails(palette, time);
  drawEntrance(style, palette, progress, time);
}

function drawPlantShadow(colors) {
  px(plantRect.x + 12, plantRect.y + 126, plantRect.w - 12, 10, colors.shadow);
  px(plantRect.x + 36, plantRect.y + 136, plantRect.w - 62, 8, colors.shadow);
  px(plantRect.x + 62, plantRect.y + 116, 90, 8, colors.shadow);
}

function drawPlantPad(colors, palette) {
  const rows = [
    { x: 198, y: 105, w: 88, c: palette.bodyLight },
    { x: 184, y: 109, w: 118, c: palette.body },
    { x: 170, y: 113, w: 148, c: palette.body },
    { x: 160, y: 117, w: 168, c: palette.bodyDark },
    { x: 154, y: 121, w: 180, c: palette.body },
    { x: 162, y: 125, w: 164, c: palette.bodyDark },
    { x: 178, y: 129, w: 132, c: palette.trimDark },
  ];

  for (const row of rows) {
    px(row.x, row.y, row.w, 4, row.c);
  }

  px(170, 117, 28, 4, colors.groundLight);
  px(304, 122, 18, 3, colors.groundDark);
  px(184, 135, 102, 7, palette.bodyDark);
  px(190, 135, 92, 3, palette.trim);

  for (let i = 0; i < 8; i += 1) {
    px(175 - i * 3, 130 + i * 3, 50 + i * 4, 3, i % 2 === 0 ? colors.path : colors.pathDark);
  }
}

function drawPlantBackPipes(palette) {
  drawPipe(
    [
      { x: 202, y: 82 },
      { x: 224, y: 84 },
      { x: 231, y: 92 },
    ],
    4,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 267, y: 91 },
      { x: 302, y: 91 },
      { x: 332, y: 111 },
      { x: 344, y: 109 },
    ],
    5,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 226, y: 119 },
      { x: 209, y: 131 },
      { x: 201, y: 137 },
    ],
    3,
    palette.trim,
    palette.bodyDark,
  );
}

function drawPlantTowers(palette) {
  drawTower(174, 62, 36, 62, palette, "left");

  if (activeStyle === "steampunk") {
    drawBoiler(284, 60, 42, 76, palette);
    drawSmokestack(326, 46, 13, 64, palette);
    drawSmokestack(304, 50, 12, 52, palette);
  } else {
    drawTower(282, 61, 42, 72, palette, "right");
    drawTechVent(327, 83, palette);
  }
}

function drawTower(x, y, width, height, palette, side) {
  px(x - 4, y - 4, width + 8, height + 8, palette.bodyDark);
  px(x, y, width, height, palette.body);
  px(x + width - 7, y, 7, height, palette.bodyDark);
  px(x + 4, y + 5, 4, height - 12, palette.bodyLight);
  px(x - 2, y - 11, width + 4, 9, palette.trimDark);
  px(x + 1, y - 14, width - 2, 8, palette.roof);
  px(x + 5, y - 12, width - 10, 3, palette.roofLight);
  px(x + 6, y + 12, 9, 26, palette.panel);
  px(x + 20, y + 16, 7, 35, palette.panel);
  px(x + 7, y + 13, 7, 3, palette.trim);
  px(x + 21, y + 17, 5, 3, palette.trim);

  if (side === "left") {
    for (let i = 0; i < 5; i += 1) {
      px(x + 5 + i * 5, y + height + 3 + i * 3, 23, 3, i % 2 === 0 ? palette.trim : palette.bodyLight);
    }
  }
}

function drawBoiler(x, y, width, height, palette) {
  px(x + 2, y + 3, width - 4, height, palette.bodyDark);
  px(x + 6, y, width - 12, height + 6, palette.body);
  px(x + 10, y + 4, width - 22, height - 4, palette.bodyLight);
  px(x + 6, y + 11, width - 12, 5, palette.trim);
  px(x + 6, y + 36, width - 12, 5, palette.trimDark);
  px(x + 6, y + 61, width - 12, 5, palette.trim);
  px(x + 2, y - 8, width - 4, 10, palette.trimDark);
  px(x + 8, y - 12, width - 16, 7, palette.trim);
  px(x + 14, y + 27, 13, 13, palette.bodyDark);
  px(x + 17, y + 30, 7, 7, palette.coreBright);
  px(x + 18, y + 31, 5, 5, palette.coreDark);
}

function drawSmokestack(x, y, width, height, palette) {
  px(x - 2, y + 5, width + 4, height, palette.bodyDark);
  px(x, y + 5, width, height, palette.body);
  px(x + 3, y + 9, 3, height - 8, palette.bodyLight);
  px(x - 3, y, width + 6, 7, palette.trimDark);
  px(x - 1, y - 4, width + 2, 5, palette.trim);
  px(x + width - 4, y + 8, 4, height - 4, palette.bodyDark);
}

function drawTechVent(x, y, palette) {
  for (let i = 0; i < 3; i += 1) {
    px(x, y + i * 13, 28, 6, palette.bodyDark);
    px(x + 2, y + i * 13 + 1, 22, 4, palette.pipe);
    px(x + 20, y + i * 13 + 1, 8, 4, palette.trim);
  }
}

function drawCorePedestal(palette) {
  px(213, 105, 61, 31, palette.bodyDark);
  px(218, 101, 52, 30, palette.body);
  px(222, 107, 44, 5, palette.trim);
  px(224, 117, 8, 13, palette.bodyLight);
  px(254, 115, 8, 15, palette.bodyLight);
  px(210, 132, 67, 6, palette.trimDark);
  px(217, 137, 52, 5, palette.bodyDark);
}

function drawCoreOrb(palette, time) {
  const pulse = 0.55 + Math.sin(time / 240) * 0.15;

  ctx.globalAlpha = 0.28 + pulse * 0.2;
  drawPixelCircle(244, 82, 32, palette.core, palette.coreDark);
  ctx.globalAlpha = 1;

  drawPixelCircle(244, 82, 25, palette.core, palette.coreDark);
  drawPixelCircle(238, 75, 9, palette.coreBright);
  drawPixelCircle(252, 91, 8, palette.coreDark);

  ctx.globalAlpha = 0.72;
  drawPixelLine(232, 83, 244, 71, 2, palette.coreBright);
  drawPixelLine(244, 71, 257, 84, 2, palette.coreBright);
  drawPixelLine(243, 91, 253, 102, 2, palette.coreBright);
  drawPixelLine(238, 96, 230, 107, 1, palette.coreBright);
  ctx.globalAlpha = 1;
}

function drawPlantFrontDetails(palette, time) {
  drawPipe(
    [
      { x: 265, y: 121 },
      { x: 291, y: 127 },
      { x: 318, y: 121 },
    ],
    3,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 194, y: 116 },
      { x: 188, y: 132 },
      { x: 199, y: 139 },
    ],
    3,
    palette.pipe,
    palette.pipeDark,
  );

  for (let i = 0; i < 4; i += 1) {
    px(229 + i * 9, 142 - i, 5, 6, palette.trim);
    px(230 + i * 9, 143 - i, 3, 4, palette.core);
  }

  if (activeStyle === "cyberpunk") {
    const blink = Math.sin(time / 120) > 0 ? palette.roofLight : palette.trim;
    px(184, 70, 5, 42, blink);
    px(294, 78, 5, 42, palette.trim);
    px(204, 126, 34, 3, palette.roof);
  }

  if (activeStyle === "futuristic") {
    px(174, 83, 34, 4, palette.trim);
    px(288, 74, 28, 4, palette.trim);
    px(303, 101, 20, 3, palette.coreBright);
  }
}

function drawEntrance(style, palette, progress, time) {
  const colors = style.scene;
  const open = clamp((progress - 0.79) / 0.16, 0, 1);
  const flicker = 0.65 + Math.sin(time / 95) * 0.25;
  const x = style.entrance.x;
  const y = style.entrance.y;

  px(x - 10, y - 13, 22, 18, palette.bodyDark);
  px(x - 8, y - 11, 18, 16, palette.trimDark);
  px(x - 5, y - 8, 12, 13, palette.door);

  ctx.globalAlpha = 0.22 + open * flicker;
  px(x - 4, y - 7, 10, 11, colors.glow);
  px(x - 1, y - 11, 4, 4, colors.glow);
  ctx.globalAlpha = 1;

  px(x - 13, y + 5, 28, 3, colors.pathDark);
  px(x - 9, y + 8, 22, 2, colors.path);
}

function drawSoldier(style, progress, time) {
  if (progress > 0.92) return;

  const eased = easeInOut(clamp(progress / 0.92, 0, 1));
  const position = getPointOnPath(walkPath, eased);
  const step = Math.floor(time / 120) % 2;
  const bob = step === 0 ? 0 : -1;
  const fade = progress > 0.84 ? 1 - clamp((progress - 0.84) / 0.08, 0, 1) * 0.35 : 1;
  const colors = style.scene.soldier;

  ctx.globalAlpha = fade;
  ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
  ctx.fillRect(Math.round(position.x - 8), Math.round(position.y + 3), 21, 5);

  const x = Math.round(position.x);
  const y = Math.round(position.y + bob);

  ctx.fillStyle = colors.boot;
  ctx.fillRect(x - 4, y - 2, 4, 7);
  ctx.fillRect(x + 4, y - 1 + step, 4, 6);
  ctx.fillRect(x - 6, y + 4, 7, 2);
  ctx.fillRect(x + 3, y + 5, 7, 2);

  ctx.fillStyle = colors.armor;
  ctx.fillRect(x - 5, y - 15, 12, 13);
  ctx.fillRect(x - 7, y - 12, 4, 8);
  ctx.fillRect(x + 7, y - 11, 4, 7);

  ctx.fillStyle = colors.armorLight;
  ctx.fillRect(x - 2, y - 14, 7, 3);
  ctx.fillRect(x + 6, y - 9, 3, 2);

  ctx.fillStyle = colors.armor;
  ctx.fillRect(x - 4, y - 23, 10, 7);
  ctx.fillRect(x - 2, y - 26, 6, 3);

  ctx.fillStyle = colors.visor;
  ctx.fillRect(x + 2, y - 21, 6, 2);

  ctx.fillStyle = colors.weapon;
  ctx.fillRect(x + 10, y - 13, 14, 2);
  ctx.fillRect(x + 21, y - 15, 5, 1);
  ctx.fillRect(x + 11, y - 11, 5, 4);

  if (activeStyle === "cyberpunk") {
    ctx.fillStyle = style.scene.glow;
    ctx.fillRect(x + 25, y - 15, 2, 2);
  }

  ctx.globalAlpha = 1;
}

function drawVignette(style) {
  const colors = style.scene;
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.28)");
  gradient.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.28;
  ctx.strokeRect(2.5, 2.5, VIEW.width - 5, VIEW.height - 5);
  ctx.globalAlpha = 1;
}

function render(now) {
  const style = styles[activeStyle];
  const elapsed = now - startedAt;
  const progress = clamp(elapsed / 7200, 0, 1);

  setStatus(progress);
  drawBackground(style, now);
  drawPlant(style, now, progress);
  drawSoldier(style, progress, now);
  drawVignette(style);

  requestAnimationFrame(render);
}

for (const button of styleButtons) {
  button.addEventListener("click", () => {
    setActiveStyle(button.dataset.style);
  });
}

replayButton.addEventListener("click", replay);

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R" || event.key === " ") {
    replay();
  }

  if (event.key === "1") setActiveStyle("steampunk");
  if (event.key === "2") setActiveStyle("cyberpunk");
  if (event.key === "3") setActiveStyle("futuristic");
});

setActiveStyle(activeStyle);
requestAnimationFrame(render);

loadReferences()
  .then(() => {
    replay();
  })
  .catch((error) => {
    console.error(error);
  });
