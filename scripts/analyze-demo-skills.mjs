import { pathToFileURL } from "node:url";

installBrowserStubs();

await import(`${pathToFileURL(`${process.cwd()}/main.js`).href}?analysis=${Date.now()}`);

const debug = globalThis.window.__POWER_PLANT_DEMO_DEBUG__;
if (!debug) throw new Error("demo debug API was not registered");

const runCount = Number.parseInt(process.argv[2] || "15", 10);
const totals = new Map();
const samples = [];

for (let cycle = 0; cycle < runCount; cycle += 1) {
  const elapsed = cycle * debug.timings.firstLoopDuration + debug.timings.explosionStart + 800;
  const snapshot = debug.getSnapshotAt(elapsed, elapsed);
  for (const row of snapshot.summary || []) {
    const ability = row.ability?.id || "none";
    const stat = totals.get(ability) || {
      ability,
      runs: 0,
      totalScore: 0,
      totalStoredScore: 0,
      totalRoundScore: 0,
      downs: 0,
      wins: 0,
    };
    stat.runs += 1;
    stat.totalScore += row.score || 0;
    stat.totalStoredScore += row.lost ? row.score + row.lost : row.score || 0;
    stat.totalRoundScore += row.roundScore || 0;
    if (row.state === "incapacitated") stat.downs += 1;
    totals.set(ability, stat);
  }

  const winner = [...(snapshot.summary || [])].sort((a, b) => (b.roundScore || 0) - (a.roundScore || 0))[0];
  if (winner?.ability?.id && totals.has(winner.ability.id)) {
    totals.get(winner.ability.id).wins += 1;
  }
  samples.push({ cycle, winner: winner?.ability?.id || "none", score: winner?.roundScore || 0 });
}

const ranked = [...totals.values()]
  .map((stat) => ({
    ...stat,
    avgScore: stat.totalScore / stat.runs,
    avgPreBlastScore: stat.totalStoredScore / stat.runs,
    avgRoundScore: stat.totalRoundScore / stat.runs,
    downRate: stat.downs / stat.runs,
  }))
  .sort((a, b) => b.avgRoundScore - a.avgRoundScore);

console.log(`# Demo skill analysis (${runCount} cycles)`);
console.log("");
console.log("| skill | avg total | avg round | avg pre-blast | downs | wins |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const stat of ranked) {
  console.log(
    `| ${stat.ability} | ${stat.avgScore.toFixed(2)} | ${stat.avgRoundScore.toFixed(2)} | ${stat.avgPreBlastScore.toFixed(2)} | ${(stat.downRate * 100).toFixed(0)}% | ${stat.wins} |`,
  );
}
console.log("");
console.log("Cycle winners:", samples.map((sample) => `${sample.cycle + 1}:${sample.winner}+${sample.score.toFixed(2)}`).join(", "));

function installBrowserStubs() {
  const elements = new Map();
  const canvas = makeCanvas();
  const styleButtons = ["steampunk", "cyberpunk", "futuristic"].map((style) => makeElement({ dataset: { style } }));

  globalThis.window = {
    location: { href: "http://127.0.0.1:8799/", pathname: "/", search: "", protocol: "http:", host: "127.0.0.1:8799" },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    AudioContext: null,
    webkitAudioContext: null,
    prompt() {},
  };
  globalThis.document = {
    documentElement: makeElement(),
    querySelector(selector) {
      if (selector === "#game-canvas") return canvas;
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === ".style-button") return styleButtons;
      return [];
    },
    createElement(tagName) {
      if (tagName === "canvas") return makeCanvas();
      return makeElement();
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async () => {} } },
  });
  globalThis.WebSocket = class WebSocketStub {
    static OPEN = 1;
  };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
}

function makeElement(overrides = {}) {
  const classes = new Set();
  return {
    dataset: {},
    style: { setProperty() {} },
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      toggle(value, force) {
        if (force === true) classes.add(value);
        else if (force === false) classes.delete(value);
        else if (classes.has(value)) classes.delete(value);
        else classes.add(value);
      },
      contains: (value) => classes.has(value),
    },
    addEventListener() {},
    setAttribute() {},
    append() {},
    replaceChildren() {},
    querySelector() {
      return makeElement();
    },
    textContent: "",
    className: "",
    value: "",
    checked: false,
    disabled: false,
    open: false,
    ...overrides,
  };
}

function makeCanvas() {
  return {
    ...makeElement(),
    width: 768,
    height: 432,
    getContext: () => makeContext(),
  };
}

function makeContext() {
  return {
    imageSmoothingEnabled: false,
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    font: "",
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect() {},
    strokeRect() {},
    drawImage() {},
    fillText() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(768 * 432 * 4) }),
  };
}
