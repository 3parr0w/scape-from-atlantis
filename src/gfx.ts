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
  at(x, y, `<circle class="rip" r="10"/><circle class="rip" r="10" style="animation-delay:.18s"/>`);
export const bubbles = (x: number, y: number): string =>
  at(x, y, [0, 1, 2, 3, 4].map((i) => `<circle class="bub" r="${1.4 + (i % 3)}" style="--dx:${rnd(16).toFixed(1)}px;animation-delay:${i * 0.09}s"/>`).join(""));
export const sparkle = (x: number, y: number): string =>
  at(x, y, [0, 1, 2, 3, 4, 5].map((i) => `<path class="spk" d="M0-5L1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" fill="#ffe066" style="--dx:${rnd(30).toFixed(1)}px;animation-delay:${i * 0.07}s"/>`).join(""));
const SP = (() => {
  let d = "";
  for (let i = 0; i <= 60; i++) {
    const a = i * 0.35, r = 3 + i * 0.9;
    d += (i ? "L" : "M") + (Math.cos(a) * r).toFixed(1) + " " + (Math.sin(a) * r).toFixed(1);
  }
  return d;
})();
export const whirl = (x: number, y: number): string =>
  at(x, y, `<g class="whirl"><path d="${SP}" fill="none" stroke="#0a4a7a" stroke-width="6" stroke-linecap="round" opacity=".35" transform="rotate(40)"/><path d="${SP}" fill="none" stroke="#e8f8ff" stroke-width="3" stroke-linecap="round" opacity=".9"/></g>`);
export const embers = (x: number, y: number): string =>
  at(x, y, `<circle class="blast" r="30" fill="#ff7b00"/>` + Array.from({ length: 16 }, (_, i) => `<circle class="emb" r="${(2 + Math.random() * 2).toFixed(1)}" fill="${["#ff9f1c", "#ff5400", "#ffd166"][i % 3]}" style="--dx:${rnd(90).toFixed(1)}px;animation-delay:${(i * 0.05).toFixed(2)}s"/>`).join(""));
