---
name: Power Plant Run
description: A tense, readable, arcade-cooperative pixel strategy game for casual dev friends.
colors:
  page-bg: "#11140f"
  panel-bg: "#1b1a14"
  panel-strong: "#2a2619"
  text: "#f1e8cf"
  muted: "#bca982"
  accent-brass: "#d5983b"
  accent-blue: "#70a8ff"
  border: "#4a3b21"
typography:
  display:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
    fontSize: "clamp(1.55rem, 1.25rem + 1vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0"
  body:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
    fontSize: "0.76rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  none: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "22px"
components:
  button-control:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "34px"
  button-control-active:
    backgroundColor: "{colors.panel-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "34px"
  room-panel:
    backgroundColor: "{colors.panel-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "4px"
---

# Design System: Power Plant Run

## 1. Overview

**Creative North Star: "Arcade War Room"**

Power Plant Run should feel like friends leaning over a chaotic little strategy board, watching a ridiculous machine tick toward disaster. The experience is product-first, but it should never feel like software for work. The surrounding interface is spare, pixel-tough, and low ceremony so the canvas can carry the personality.

The game uses compact controls, hard-edged panels, monospace labels, and high-contrast pixel signals. Its charm comes from pressure, tiny tactical choices, and readable absurdity: a big countdown, risky high-value nodes, a blast circle, and final scores that make the outcome obvious.

**Key Characteristics:**
- Fast to parse under time pressure.
- Chunky pixel affordances instead of SaaS components.
- Warm industrial palette with brass and blue energy accents.
- Minimal account chrome, GitHub is presence, not product identity.
- Wacky motion and state changes, but never at the cost of scoring clarity.

## 2. Colors

The palette is murky industrial green-black with brass warning color and blue power-plant energy. It should feel physical and game-like, not corporate.

### Primary
- **Warning Brass** (#d5983b): countdown rails, selected controls, node-value emphasis, and urgent affordances.

### Secondary
- **Power Core Blue** (#70a8ff): energy glow, active power details, and contrast against the brown-green field.

### Neutral
- **Oil Field Black** (#11140f): page background and deep canvas surround.
- **Boiler Panel** (#1b1a14): topbar groups and inactive UI panels.
- **Burnt Brass Panel** (#2a2619): active control surface and raised UI patches.
- **Steam Text** (#f1e8cf): main text and canvas labels.
- **Aged Gauge Muted** (#bca982): secondary labels and quieter status text.
- **Riveted Border** (#4a3b21): panel outlines, input edges, and low-intensity dividers.

### Named Rules

**The Countdown Owns Orange Rule.** Orange/brass should be strongest on timer pressure, node values, and active gameplay decisions. Do not spend it on decorative UI.

## 3. Typography

**Display Font:** ui-monospace stack  
**Body Font:** ui-monospace stack  
**Label/Mono Font:** ui-monospace stack

**Character:** The type should feel like an arcade cabinet label and a terminal had an argument. It is blunt, compact, and readable at small sizes.

### Hierarchy
- **Display** (700, clamp(1.55rem, 1.25rem + 1vw, 2.25rem), 1.05): game title and rare first-level screen labels.
- **Headline** (700, 13px canvas monospace): final score title and large canvas state labels.
- **Title** (700, 8px canvas monospace): canvas panels such as player scores and summaries.
- **Body** (400, 0.92rem, 1.35): short status copy around the game shell.
- **Label** (600, 0.76rem, 1): controls, room codes, buttons, and compact HUD text.

### Named Rules

**The Eight-Second Read Rule.** Any critical canvas text must be understood in one glance while the player is moving.

## 4. Elevation

The system uses tonal layering and hard borders more than soft physical elevation. Shadows exist around topbar control groups and overlays, but the game should feel pixel-solid, not floating or glassy.

### Shadow Vocabulary
- **Panel Drop** (`0 12px 28px rgba(0, 0, 0, 0.42)`): topbar groups and overlays that need separation from the page.
- **Pixel Overlay** (`rgba(0, 0, 0, 0.58)` to `rgba(0, 0, 0, 0.72)` fills): canvas HUD and score panels.

### Named Rules

**The No Glass Rule.** Use solid dark fills, borders, and pixel blocks. Do not introduce blur-backed glass panels.

## 5. Components

### Buttons
- **Shape:** square pixel edge, no radius (`0`).
- **Primary:** transparent at rest with Steam Text, 34px height, compact horizontal padding.
- **Hover / Focus:** brass-tinted panel fill with a brass border. Focus must remain visible.
- **Active:** brass border with a low brass fill. Use active states for selected style and ready state.

### Chips
- **Style:** use compact swatches for visual modes, not pill badges.
- **State:** selected mode gets the same active brass treatment as buttons.

### Cards / Containers
- **Corner Style:** square, pixel-like corners.
- **Background:** Boiler Panel or black translucent canvas overlays.
- **Shadow Strategy:** use Panel Drop only for top-level controls or modal-like overlays.
- **Border:** Riveted Border, 1px. Never add a thick side stripe.
- **Internal Padding:** tight, usually 4px to 12px. Large cards make the game feel like SaaS.

### Inputs / Fields
- **Style:** compact dark field with Riveted Border, monospace text, no rounded corners.
- **Focus:** switch border to Warning Brass.
- **Disabled:** lower opacity, retain layout stability.

### Navigation
- **Style:** no full navigation shell. The topbar is the control deck, and the canvas is the product.

### Game Canvas
- **Countdown:** big, blinking, and mounted visually on or near the power plant. It should beat every other label in hierarchy during repair phase.
- **Repair Nodes:** use a glowing radius ring, a blocky center, and a visible decimal value. Higher-value and bonus nodes should look hotter and stranger, but values should stay compact enough that a repaired map does not stretch the round into dead time.
- **Claim Timers:** when a player claims a node, a small follow timer rides above that player. It should read like a fuse: compact, brass-led, and impossible to confuse with score.
- **Final Scores:** after the round ends, show a scoreboard-first screen. Do not keep showing the live board as the primary surface.

## 6. Do's and Don'ts

### Do:
- **Do** make countdown, node value, blast risk, and final score readable before decorative detail.
- **Do** keep the UI compact and game-like, with square corners and monospace labels.
- **Do** use brass for urgency and decisions, blue for power energy, and muted neutrals for shell chrome.
- **Do** use shape, label, and position in addition to color for gameplay state.
- **Do** let the experience be fun and wacky when it does not reduce clarity.

### Don't:
- **Don't** make the interface too SaaS-like, too polished-enterprise, or too productivity-app clean.
- **Don't** use rounded marketing cards, hero-metric layouts, gradient text, glassmorphism, or thick side-stripe borders.
- **Don't** bury the timer in the HUD when the building itself is supposed to be dangerous.
- **Don't** rely on color alone for repaired state, blast danger, or score result.
- **Don't** add long instructional copy where a stronger game signal would do the job.
