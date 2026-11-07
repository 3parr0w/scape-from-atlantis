// Vector art + effect snippets for the board. Everything is plain SVG strings (no emoji, no images),
// so the board looks the same on every device. All shapes are centred on (0,0).
export const person = (col: string, rider = false): string => {
  const ln = rider ? "#3b2410" : "#fff";
  return (
    `<g class="mp"><ellipse cx="0" cy="9.4" rx="7" ry="2.2" fill="#00122a" opacity=".35"/>` +
    `<path d="M-3.4-3.2C-8.6-2.4-9 2.6-6.6 4.6L-4.4 5.2-6 9.2H6L4.4 5.2 6.6 4.6C9 2.6 8.6-2.4 3.4-3.2Z" fill="${col}" stroke="${ln}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="0" cy="-7.2" r="3.9" fill="${col}" stroke="${ln}" stroke-width="1.5"/>` +
    `<ellipse cx="-3.1" cy="1.2" rx="1.2" ry="2.3" fill="#fff" opacity=".3"/><path d="M-2.3-9.4A3 3 0 0 1 .9-10.2" stroke="#fff" stroke-opacity=".65" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`
  );
};
export const boat = (): string =>
  `<g class="bt"><ellipse cx="0" cy="10.5" rx="15" ry="3" fill="#fff" opacity=".35"/>` +
  `<path d="M-13 3H13L8.5 10H-8.5Z" fill="#8a5a2b" stroke="#3b2410" stroke-width="1.4" stroke-linejoin="round"/><path d="M-11 5.2H11" stroke="#c99a5b" stroke-width="1.2"/>` +
  `<path d="M0 3V-14" stroke="#3b2410" stroke-width="1.6"/><path d="M1.5-13L11 1H1.5Z" fill="#fff" stroke="#8b97a8" stroke-width=".8" stroke-linejoin="round"/>` +
  `<path d="M-1.5-9L-9 1H-1.5Z" fill="#f4e7c6" stroke="#8b97a8" stroke-width=".8" stroke-linejoin="round"/><path d="M0-14L6-12.2 0-10.6Z" fill="#e63946"/></g>`;
const SERP = "M-15 7Q-10-5-5 3T5 3T11-5";
const serpent = (): string =>
  `<g class="cr"><path d="${SERP}" fill="none" stroke="#2d1245" stroke-width="7.4" stroke-linecap="round"/><path d="${SERP}" fill="none" stroke="#9a5bd0" stroke-width="5" stroke-linecap="round"/>` +
  `<path d="${SERP}" fill="none" stroke="#d9b8f5" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1 4"/>` +
  `<path d="M-9-3L-8-7 -6.2-3.6M-1-1.4L0-5.4 1.8-2M7-2L8-6 9.8-2.6" fill="#e0b8ff" stroke="#2d1245" stroke-width=".8" stroke-linejoin="round"/>` +
  `<ellipse cx="13" cy="-8" rx="5.6" ry="4.2" fill="#9a5bd0" stroke="#2d1245" stroke-width="1.4" transform="rotate(-25 13 -8)"/><circle cx="14.6" cy="-9.4" r="1.5" fill="#fff"/><circle cx="15" cy="-9.4" r=".7" fill="#111"/>` +
  `<path d="M17.6-7L20.6-8M17.6-7L20.6-5.6" stroke="#e63946" stroke-width="1" fill="none"/></g>`;
const shark = (): string =>
  `<g class="cr"><path d="M-16 3C-9-5 4-6 13 1C9 6-6 8-16 3Z" fill="#7d93a8" stroke="#2a3a4a" stroke-width="1.4" stroke-linejoin="round"/><path d="M-14 4.2C-6 7 6 6 12 2.4C8 6-6 8-14 4.2Z" fill="#e6eef4"/>` +
  `<path d="M-3-3.4L1.5-12 5.4-2.6Z" fill="#6b8095" stroke="#2a3a4a" stroke-width="1.2" stroke-linejoin="round"/><path d="M-16 3L-21-3.5-19 3-21.5 9Z" fill="#6b8095" stroke="#2a3a4a" stroke-width="1.2" stroke-linejoin="round"/>` +
  `<circle cx="8.4" cy="-.4" r="1.2" fill="#111"/><path d="M12 1.6L10.6 3.2M10 2.4L8.8 4.2" stroke="#fff" stroke-width="1.2"/></g>`;
const whale = (): string =>
  `<g class="cr"><path d="M-14 3C-13-9 9-10 14-1C16 4 11 9 1 9C-8 9-14 8-14 3Z" fill="#3f7fc2" stroke="#173a63" stroke-width="1.5" stroke-linejoin="round"/><path d="M-12 5C-4 9 8 9 13 3C10 8-3 10-12 5Z" fill="#cfe6fa"/>` +
  `<path d="M-14 3Q-19-3-22-4-20 0-17 2-20 6-23 9-17 7-13 5Z" fill="#3f7fc2" stroke="#173a63" stroke-width="1.3" stroke-linejoin="round"/>` +
  `<circle cx="8.5" cy="-1" r="1.3" fill="#fff"/><circle cx="8.8" cy="-1" r=".65" fill="#111"/><path d="M2-9Q2-14-1-16M2-9Q2-14 5-16" stroke="#bfe9ff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
export const creature = (t: string): string =>
  t === "shark" ? shark() : t === "whale" ? whale() : serpent();
export const island = (): string =>
  `<g pointer-events="none"><path d="M-22 6Q-16-3 0-2Q16-3 22 6Q0 15-22 6Z" fill="#f3d98d" stroke="#b8924a" stroke-width="1"/><path d="M-12 1Q-5-8 3-1Z" fill="#4aa653"/>` +
  `<path d="M5 4Q7-7 7-12" stroke="#8a5a2b" stroke-width="2.2" fill="none"/><path d="M7-12q-8-2-11 3M7-12q8-2 11 3M7-12q-2-8-9-6M7-12q3-7 10-4" stroke="#2f9e44" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`;
export const anchor = (): string =>
  `<g stroke="#ffd166" stroke-width="1.7" fill="none" stroke-linecap="round"><circle cx="0" cy="-6" r="2"/><path d="M0-4V8M-4-1H4M-8 3Q-6 8 0 8Q6 8 8 3"/></g>`;
export const dieFace = (t: string): string =>
  `<svg viewBox="-26 -20 52 40" width="86" height="66">${creature(t)}</svg>`;

// ---- transient effects (placed in the #fx layer; CSS in shell.html animates them) ----
const at = (x: number, y: number, inner: string): string =>
  `<g style="transform:translate(${x}px,${y}px)">${inner}</g>`;
const rnd = (a: number): number => (Math.random() - 0.5) * a;
export const ripple = (x: number, y: number): string =>
  at(
    x,
    y,
    `<circle class="rip" r="10"/><circle class="rip" r="10" style="animation-delay:.18s"/>`,
  );
export const bubbles = (x: number, y: number): string =>
  at(
    x,
    y,
    [0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<circle class="bub" r="${1.4 + (i % 3)}" style="--dx:${rnd(16).toFixed(1)}px;animation-delay:${i * 0.09}s"/>`,
      )
      .join(""),
  );
export const sparkle = (x: number, y: number): string =>
  at(
    x,
    y,
    [0, 1, 2, 3, 4, 5]
      .map(
        (i) =>
          `<path class="spk" d="M0-5L1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" fill="#ffe066" style="--dx:${rnd(30).toFixed(1)}px;animation-delay:${i * 0.07}s"/>`,
      )
      .join(""),
  );
const SP = (() => {
  let d = "";
  for (let i = 0; i <= 60; i++) {
    const a = i * 0.35,
      r = 3 + i * 0.9;
    d +=
      (i ? "L" : "M") +
      (Math.cos(a) * r).toFixed(1) +
      " " +
      (Math.sin(a) * r).toFixed(1);
  }
  return d;
})();
export const whirl = (x: number, y: number): string =>
  at(
    x,
    y,
    `<g class="whirl"><path d="${SP}" fill="none" stroke="#0a4a7a" stroke-width="6" stroke-linecap="round" opacity=".35" transform="rotate(40)"/><path d="${SP}" fill="none" stroke="#e8f8ff" stroke-width="3" stroke-linecap="round" opacity=".9"/></g>`,
  );
export const embers = (x: number, y: number): string =>
  at(
    x,
    y,
    `<circle class="blast" r="30" fill="#ff7b00"/>` +
      Array.from(
        { length: 16 },
        (_, i) =>
          `<circle class="emb" r="${(2 + Math.random() * 2).toFixed(1)}" fill="${["#ff9f1c", "#ff5400", "#ffd166"][i % 3]}" style="--dx:${rnd(90).toFixed(1)}px;animation-delay:${(i * 0.05).toFixed(2)}s"/>`,
      ).join(""),
  );

// ---- tile-card art (hand cards, reveal and defence dialogs) ----
const sc = (inner: string, z: number, x = 0, y = 0): string =>
  `<g transform="translate(${x} ${y}) scale(${z})">${inner}</g>`;
const dolphin = (): string =>
  `<path d="M-17 5C-12-9 4-12 13-5L20-9 18-1 12 2C6 8-7 10-17 5Z" fill="#4f9fd6" stroke="#174a73" stroke-width="1.4" stroke-linejoin="round"/><path d="M-14 6C-6 9 6 8 12 3C6 9-7 11-14 6Z" fill="#dff1fb"/><path d="M-3-7L2-14 4-5Z" fill="#3b86bd" stroke="#174a73" stroke-width="1.1" stroke-linejoin="round"/><path d="M-17 5L-22 0-21 6-23 11Z" fill="#3b86bd" stroke="#174a73" stroke-width="1.1" stroke-linejoin="round"/><circle cx="9" cy="-2" r="1.2" fill="#111"/>`;
const windArt = (): string =>
  `<g fill="none" stroke="#e8f4ff" stroke-width="2.2" stroke-linecap="round"><path d="M-18-6H6Q13-6 13-11T6-15"/><path d="M-18 1H12Q20 1 20-5"/><path d="M-18 8H2Q9 8 9 13T3 18"/></g>`;
const volcano = (): string =>
  `<path d="M-19 15L-6-6H6L19 15Z" fill="#6b4a3a" stroke="#3a2418" stroke-width="1.4" stroke-linejoin="round"/><path d="M-6-6L-3-10H3L6-6Q0-3-6-6Z" fill="#ff7b00"/><circle cx="-3" cy="-14" r="3" fill="#aaa" opacity=".7"/><circle cx="3" cy="-18" r="4" fill="#bbb" opacity=".55"/><path d="M-1-10L-4-3 0-5 2-1" stroke="#ffd166" stroke-width="1.4" fill="none"/>`;
const shield = (): string =>
  `<g transform="translate(9 3)"><path d="M0-8L8-6V1C8 6 4 9 0 11C-4 9-8 6-8 1V-6Z" fill="#ffd166" stroke="#7a5a10" stroke-width="1.3" stroke-linejoin="round"/><path d="M0-4V6M-4 0H4" stroke="#7a5a10" stroke-width="1.4"/></g>`;
const MVT: Record<string, string> = {
  mserp: "serp",
  mshark: "shark",
  mwhale: "whale",
};
export const cardArt = (t: string): string => {
  switch (t) {
    case "shark":
    case "whale":
      return sc(creature(t), 1.05);
    case "boat":
      return sc(boat(), 1.3, 0, 2);
    case "whirl":
      return `<path d="${SP}" transform="scale(.42)" fill="none" stroke="#e8f8ff" stroke-width="5" stroke-linecap="round"/>`;
    case "volc":
      return volcano();
    case "dolph":
      return dolphin();
    case "wind":
      return windArt();
    case "mserp":
    case "mshark":
    case "mwhale":
      return (
        sc(creature(MVT[t]!), 0.85, 0, -3) +
        `<path d="M-13 14h26M-13 14l4-3M-13 14l4 3M13 14l-4-3M13 14l-4 3" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
      );
    case "rshark":
    case "rwhale":
      return (
        sc(creature(t === "rshark" ? "shark" : "whale"), 0.8, -5, -2) + shield()
      );
    default:
      return "";
  }
};
export const cardSvg = (t: string, w = 150): string =>
  `<svg viewBox="-26 -20 52 40" width="${w}" height="${Math.round((w * 40) / 52)}">${cardArt(t)}</svg>`;

// ---- inline icons -------------------------------------------------------------------------
// Every glyph the UI used to take from an emoji/symbol font lives here instead, as SVG: colour
// emoji look different on every platform (and some symbols, like the fit/expand arrow, are simply
// missing from most fonts and render as a blank box). These are drawn on a 24x24 grid, stroked with
// `currentColor` so they inherit the button/text colour, and sized by the caller.

export const ART_VB = "-26 -20 52 40";
const UI: Record<string, string> = {
  zoomin:
    '<circle cx="10.5" cy="10.5" r="6.4"/><path d="M15.5 15.5 21 21M10.5 7.7v5.6M7.7 10.5h5.6"/>',
  zoomout:
    '<circle cx="10.5" cy="10.5" r="6.4"/><path d="M15.5 15.5 21 21M7.7 10.5h5.6"/>',
  fit: '<path d="M4 9.2V4h5.2M20 9.2V4h-5.2M4 14.8V20h5.2M20 14.8V20h-5.2"/>',
  sound:
    '<path d="M4.2 9.4h3.3L12.4 5.6v12.8L7.5 14.6H4.2z"/><path d="M15.6 9.3a4.1 4.1 0 0 1 0 5.4M18.2 6.9a7.6 7.6 0 0 1 0 10.2"/>',
  mute: '<path d="M4.2 9.4h3.3L12.4 5.6v12.8L7.5 14.6H4.2z"/><path d="M16 9.6l4.8 4.8M20.8 9.6 16 14.4"/>',
  warn: '<path d="M12 3.7 21.5 20h-19z"/><path d="M12 9.7v4.5M12 17.3v.2"/>',
  undo: '<path d="M3.6 4.6v5.6h5.6"/><path d="M3.6 15.1a8.6 8.6 0 1 0 1.9-8.7L3.6 10"/>',
  dice: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.2"/><circle cx="8.2" cy="8.2" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.8" cy="8.2" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="8.2" cy="15.8" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.8" cy="15.8" r="1.35" fill="currentColor" stroke="none"/>',
  dot: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
  check: '<path d="M4.5 12.6 9.5 17.6 19.5 6.9"/>',
  cross: '<path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4M12 7.7v.2"/>',
  trophy:
    '<path d="M8 4.6h8v4.1a4 4 0 0 1-8 0z"/><path d="M8 5.6H5.4a2.5 2.5 0 0 0 2.7 3.1M16 5.6h2.6a2.5 2.5 0 0 1-2.7 3.1"/><path d="M12 12.7v3.4M8.9 20h6.2M10 16.1h4"/>',
};
export const icon = (n: string, size = 18, cls = "ic"): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${UI[n] || ""}</svg>`;

/** A piece of card art (tile content) sized for inline text or a chip. */
export const tileIcon = (t: string, size = 18): string =>
  `<svg class="ic" viewBox="${ART_VB}" width="${size}" height="${Math.round((size * 40) / 52)}" aria-hidden="true">${cardArt(t)}</svg>`;

/** A creature sprite sized for inline text or a chip. */
export const creatureIcon = (t: string, size = 18): string =>
  `<svg class="ic" viewBox="${ART_VB}" width="${size}" height="${Math.round((size * 40) / 52)}" aria-hidden="true">${creature(t)}</svg>`;

/** Small on/off marker used for the remaining-move pips (replaces the ●/○ glyphs). */
export const pip = (on: boolean): string =>
  `<svg class="ic pip" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">${on ? '<circle cx="6" cy="6" r="4.2" fill="currentColor"/>' : '<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'}</svg>`;
