// Shared constants, Persian text tables, board geometry and small DOM helpers for the browser app.
// Pure data/helpers only: no mutable application state lives here (that is ./state.ts).
import A from "../engine";
import * as G2 from "../gfx";

const { SAFE, DOCK, SERP, NB, P, CELLS } = A;
export { SAFE, DOCK, SERP, NB, P, CELLS };

export const $ = (s: string): any => document.querySelector(s);
export const R3 = Math.sqrt(3);
export const SZ = 28;
export const C = ["#e63946", "#17a398", "#f2b705", "#8e5bd0"];
export const PN = ["قرمز", "سبز", "زرد", "بنفش"];

// Tile content: [inline vector icon, name, description]. The icon is the same art the card and the
// board use, so a tile looks identical in the log, in the dialogs and on the table (no emoji).
export const T: Record<string, [string, string, string]> = {
  shark: [
    G2.tileIcon("shark", 20),
    "کوسه",
    "فوراً روی دریای همین خانه می‌آید؛ شناگرها می‌میرند.",
  ],
  whale: [
    G2.tileIcon("whale", 20),
    "نهنگ",
    "فوراً روی دریای همین خانه می‌آید.",
  ],
  boat: [
    G2.tileIcon("boat", 20),
    "قایق",
    "یک قایق می‌آید و تا ۳ شناگر سوار می‌شوند.",
  ],
  whirl: [
    G2.tileIcon("whirl", 20),
    "گرداب",
    "همه‌چیز در این خانه و خانه‌های دریایی مجاور نابود می‌شود.",
  ],
  volc: [G2.tileIcon("volc", 20), "آتشفشان!", "بازی تمام شد."],
  dolph: [
    G2.tileIcon("dolph", 20),
    "دلفین",
    "به دستت می‌رود: یک شناگر را تا ۳ خانه ببر.",
  ],
  wind: [
    G2.tileIcon("wind", 20),
    "باد مساعد",
    "به دستت می‌رود: یک قایق را تا ۳ خانه ببر.",
  ],
  mserp: [
    G2.tileIcon("mserp", 20),
    "جابه‌جایی مار",
    "به دستت می‌رود: یک مار را به خانه‌ی خالی ببر.",
  ],
  mshark: [
    G2.tileIcon("mshark", 20),
    "جابه‌جایی کوسه",
    "به دستت می‌رود: یک کوسه را به خانه‌ی خالی ببر.",
  ],
  mwhale: [
    G2.tileIcon("mwhale", 20),
    "جابه‌جایی نهنگ",
    "به دستت می‌رود: یک نهنگ را به خانه‌ی خالی ببر.",
  ],
  rshark: [
    G2.tileIcon("rshark", 20),
    "دفع کوسه",
    "دفاعی: وقتی حریف کوسه را روی شناگر تو می‌آورد.",
  ],
  rwhale: [
    G2.tileIcon("rwhale", 20),
    "دفع نهنگ",
    "دفاعی: وقتی حریف نهنگ را روی قایق تحت کنترل تو می‌آورد.",
  ],
};

// Persian name of each creature, for status lines and log entries (the icon comes from gfx.ts).
export const CR: Record<string, string> = {
  serp: "مار دریایی",
  shark: "کوسه",
  whale: "نهنگ",
};

export const hex = (x: number, y: number, r = SZ): string =>
  [0, 1, 2, 3, 4, 5]
    .map(
      (i) =>
        (x + r * Math.cos((i * Math.PI) / 3)).toFixed(1) +
        "," +
        (y + r * Math.sin((i * Math.PI) / 3)).toFixed(1),
    )
    .join(" ");

export const POS: Record<string, { x: number; y: number }> = {};
CELLS.forEach((k: string) => {
  const [c, r] = P(k) as [number, number];
  POS[k] = {
    x: SZ * 1.5 * c + SZ + 8,
    y: SZ * R3 * (r + 0.5 * (c & 1)) + (SZ * R3) / 2 + 8,
  };
});

// Where up to seven tokens on one cell are offset, so a stack stays readable.
export const OFF = [
  [0, 3],
  [-13, -6],
  [13, -6],
  [-13, 12],
  [13, 12],
  [0, -8],
  [0, 18],
];

export const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// Log entries may contain inline icons; the collapsed <summary> is plain text, so strip the markup
// there (otherwise the raw <svg> shows up as text in the title line).
export const plain = (s: string): string =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const cleanName = (n: string): string =>
  n
    .replace(/[<>&"'`]/g, "")
    .trim()
    .slice(0, 16);

export const val = (id: string): string => ($(id) || {}).value || "";
export const canFocus = (el: any): boolean =>
  !!el && typeof el.focus === "function";

export interface Tk {
  x: number;
  y: number;
  k: string;
  kind: string;
  col: string;
}

export const artOf = (kind: string, col: string): string =>
  kind === "person"
    ? G2.person(col)
    : kind === "rider"
      ? `<g transform="scale(.86)">${G2.person(col, true)}</g>`
      : kind === "boat"
        ? G2.boat()
        : G2.creature(kind);
