// Survive: Escape from Atlantis — pure game engine (no DOM, no I/O). Works in browser and Node.
// State is plain JSON. apply(state, playerIdx, action) -> {state, events} | {error}. view(state, playerIdx) hides secrets.
// Actions: placePerson{k,id} placeBoat{k} | skipTile, dolph{p,to}, wind{b,to}, mcreat{tile,c,to} | movePerson{p,to}, moveBoat{b,to}, undo, endMoves
//          | take{k} | roll | moveCreature{c,to}, skipCreature | defend{play} (only the player in state.pending.queue[0])

// ------------------------------------------------------------------ types

export type TileType = "b" | "f" | "m";
export type CreatureType = "serp" | "shark" | "whale";
export type Phase =
  | "setP"
  | "setB"
  | "play"
  | "move"
  | "take"
  | "roll"
  | "creature"
  | "end";

export type Loc =
  | { t: "hand" }
  | { t: "land"; k: string }
  | { t: "sea"; k: string }
  | { t: "boat"; b: number }
  | { t: "safe" }
  | { t: "dead" };

export interface Person {
  id: number;
  o: number;
  n: number;
  loc: Loc;
}
export interface PersonView {
  id: number;
  o: number;
  n: number | null;
  loc: Loc;
}
export interface Boat {
  id: number;
  k: string;
}
export interface Creature {
  id: number;
  t: CreatureType;
  k: string;
}
export interface Tile {
  type: TileType;
  cont: ContentType;
}
export interface Pending {
  c: number;
  k: string;
  mover: number;
  queue: number[];
  tile: "rshark" | "rwhale";
}
export interface Result {
  o: number;
  nums: number[];
  total: number;
}

export const CONT = {
  shark: 6,
  whale: 5,
  boat: 4,
  whirl: 2,
  volc: 1,
  dolph: 3,
  wind: 3,
  mserp: 2,
  mshark: 2,
  mwhale: 2,
  rshark: 5,
  rwhale: 5,
} as const;
export type ContentType = keyof typeof CONT;

/** The subset of board data that destinations depend on — satisfied by both State and ViewState. */
export interface BoardState {
  n: number;
  tiles: Record<string, { type: TileType }>;
  people: PersonView[];
  boats: Boat[];
  creat: Creature[];
  hands: (ContentType | null)[][];
  moves: number;
  roll: CreatureType | null;
  pending: Pending | null;
  over: boolean;
  phase: Phase;
  cur: number;
}

export interface State extends BoardState {
  seed: number;
  tiles: Record<string, Tile>;
  people: Person[];
  hands: ContentType[][];
  boatsLeft: number[];
  result: Result[] | null;
  undo: string[];
  id: number;
}

export interface ViewState extends BoardState {
  boatsLeft: number[];
  result: Result[] | null;
  id: number;
  me: number;
  canUndo: boolean;
}

export type Action =
  | { t: "placePerson"; k: string; id?: number }
  | { t: "placeBoat"; k: string }
  | { t: "skipTile" }
  | { t: "dolph"; p: number; to: string }
  | { t: "wind"; b: number; to: string }
  | { t: "mcreat"; tile: ContentType; c: number; to: string }
  | { t: "movePerson"; p: number; to: string }
  | { t: "moveBoat"; b: number; to: string }
  | { t: "undo" }
  | { t: "endMoves" }
  | { t: "take"; k: string }
  | { t: "roll" }
  | { t: "moveCreature"; c: number; to: string }
  | { t: "skipCreature" }
  | { t: "defend"; play: boolean };

export type Ev =
  | { type: "turn"; cur: number }
  | { type: "end" }
  | { type: "took"; pl: number; k: string; cont: ContentType | null }
  | { type: "reveal"; to: number; cont: ContentType; k: string }
  | { type: "saved"; pl: number }
  | { type: "roll"; pl: number; face: CreatureType }
  | { type: "cmove"; pl: number; t: CreatureType }
  | { type: "defended"; pl: number; tile: ContentType }
  | { type: "capsize"; k: string }
  | { type: "devoured"; k: string };

export interface Sel {
  p?: number;
  b?: number;
  c?: number;
}
export type ApplyResult = { state: State; events: Ev[] } | { error: string };

// ------------------------------------------------------------------ constants

export const W = 17,
  H = 11;
export const SAFE = ["0,0", "16,0", "0,10", "16,10"];
export const DOCK: Record<string, string> = {
  "1,0": "0,0",
  "0,1": "0,0",
  "15,0": "16,0",
  "16,1": "16,0",
  "1,9": "0,10",
  "0,9": "0,10",
  "15,9": "16,10",
  "16,9": "16,10",
};
export const SERP = ["8,5", "0,1", "16,1", "0,9", "16,9"];
const CUT = ["8,5", "4,4", "12,4"];
export const NUMS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 6];
export const MV: Record<string, CreatureType> = {
  mserp: "serp",
  mshark: "shark",
  mwhale: "whale",
};
export const RANGE: Record<CreatureType, number> = {
  serp: 1,
  shark: 2,
  whale: 3,
};
const DIE: CreatureType[] = [
  "serp",
  "serp",
  "shark",
  "shark",
  "whale",
  "whale",
];
export const PUBLIC: ContentType[] = [
  "shark",
  "whale",
  "boat",
  "whirl",
  "volc",
];

export const kk = (c: number, r: number): string => c + "," + r;
export const P = (k: string): number[] => k.split(",").map(Number);
export const NB = (k: string): string[] => {
  const [c, r] = P(k) as [number, number];
  const dirs: [number, number][] =
    c & 1
      ? [
          [1, 0],
          [1, 1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
        ]
      : [
          [1, 0],
          [1, -1],
          [-1, 0],
          [-1, -1],
          [0, -1],
          [0, 1],
        ];
  return dirs
    .map(([a, b]) => [c + a, r + b] as [number, number])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H)
    .map(([x, y]) => kk(x, y));
};

export const CELLS: string[] = [];
export const LAND: string[] = [];
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) CELLS.push(kk(c, r));
[3, 4, 5, 6, 7, 6, 5, 4, 3].forEach((L, i) => {
  const c = i + 4,
    s = 5 - (L - 1) / 2 - 0.5 * (c & 1);
  for (let r = s; r < s + L; r++)
    if (!CUT.includes(kk(c, r))) LAND.push(kk(c, r));
});

// ------------------------------------------------------------------ random

interface Seedable {
  seed: number;
}
const rand = (S: Seedable): number => {
  S.seed = (S.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(S.seed ^ (S.seed >>> 15), 1 | S.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = <T>(S: Seedable, a: T[]): T[] => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(S) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

// ------------------------------------------------------------------ board queries

const isSea = (S: BoardState, k: string): boolean =>
  !S.tiles[k] && !SAFE.includes(k);
const boatAt = (S: BoardState, k: string): Boat | undefined =>
  S.boats.find((b) => b.k === k);
const riders = (S: BoardState, b: Boat): PersonView[] =>
  S.people.filter((p) => p.loc.t === "boat" && p.loc.b === b.id);
export const pk = (S: BoardState, p: { loc: Loc }): string =>
  p.loc.t === "boat"
    ? S.boats.find((b) => b.id === (p.loc as { b: number }).b)!.k
    : (p.loc as { k: string }).k;
const swim = (S: BoardState, k: string): PersonView[] =>
  S.people.filter((p) => p.loc.t === "sea" && p.loc.k === k);
const crAt = (S: BoardState, k: string, t?: CreatureType[]): Creature[] =>
  S.creat.filter((c) => c.k === k && (!t || t.includes(c.t)));
const own = (S: BoardState, b: Boat): number[] => {
  const n: Record<number, number> = {};
  riders(S, b).forEach((p) => (n[p.o] = (n[p.o] || 0) + 1));
  const m = Math.max(0, ...Object.values(n));
  return Object.keys(n)
    .filter((o) => n[Number(o)] === m)
    .map(Number);
};
const canB = (S: BoardState, b: Boat, pl: number): boolean =>
  !riders(S, b).length || own(S, b).includes(pl);
const cap = (S: BoardState, k: string): { t: "boat"; b: number } | null => {
  const b = boatAt(S, k);
  return b && riders(S, b).length < 3 ? { t: "boat", b: b.id } : null;
};
const die = (p: PersonView): void => {
  p.loc = { t: "dead" };
};
const sink = (S: State, b: Boat, sw: boolean): void => {
  riders(S, b).forEach((p) => {
    p.loc = sw ? { t: "sea", k: b.k } : { t: "dead" };
  });
  S.boats = S.boats.filter((x) => x !== b);
};
const hazard = (S: State, k: string): void => {
  if (crAt(S, k, ["serp", "shark"]).length) swim(S, k).forEach(die);
};
const empty = (S: BoardState, k: string): boolean =>
  isSea(S, k) && !boatAt(S, k) && !crAt(S, k).length && !swim(S, k).length;

function opts(S: BoardState, p: { loc: Loc }): { k: string; to: Loc }[] {
  const L = p.loc,
    o: { k: string; to: Loc }[] = [];
  if (L.t === "land") {
    NB(L.k).forEach((n) => {
      if (S.tiles[n]) o.push({ k: n, to: { t: "land", k: n } });
      else if (isSea(S, n))
        o.push({ k: n, to: cap(S, n) || { t: "sea", k: n } });
    });
  } else if (L.t === "sea" || L.t === "boat") {
    const k = pk(S, p);
    if (L.t === "sea" && cap(S, k)) o.push({ k, to: cap(S, k)! });
    if (DOCK[k]) o.push({ k: DOCK[k]!, to: { t: "safe" } });
    NB(k).forEach((n) => {
      if (isSea(S, n)) o.push({ k: n, to: cap(S, n) || { t: "sea", k: n } });
    });
  }
  return o;
}

function reach(
  S: BoardState,
  k: string,
  n: number,
  stop?: (k: string) => boolean,
): string[] {
  const seen: Record<string, number> = { [k]: 0 };
  const q = [k];
  const out: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    if (seen[u]! >= n || (u !== k && stop && stop(u))) continue;
    NB(u).forEach((v) => {
      if (isSea(S, v) && seen[v] === undefined) {
        seen[v] = seen[u]! + 1;
        q.push(v);
        out.push(v);
      }
    });
  }
  return out;
}

export function cands(S: BoardState): string[] {
  for (const t of ["b", "f", "m"] as TileType[]) {
    const l = Object.keys(S.tiles).filter(
      (k) => S.tiles[k]!.type === t && NB(k).some((x) => isSea(S, x)),
    );
    if (l.length) return l;
  }
  return Object.keys(S.tiles);
}

// ------------------------------------------------------------------ new game

export function newGame(n: number, seed?: number): State {
  const S: State = {
    n,
    seed: (seed == null ? Date.now() : seed) | 0,
    tiles: {},
    people: [],
    boats: [],
    creat: [],
    hands: Array.from({ length: n }, () => [] as ContentType[]),
    boatsLeft: Array(n).fill(2),
    cur: 0,
    phase: "setP",
    moves: 3,
    roll: null,
    pending: null,
    over: false,
    result: null,
    undo: [],
    id: 100,
  };
  const ty = shuffle(S, [
    ...Array(16).fill("b"),
    ...Array(16).fill("f"),
    ...Array(8).fill("m"),
  ] as TileType[]);
  const cs = shuffle(
    S,
    Object.entries(CONT).flatMap(([k, v]) => Array(v).fill(k)) as ContentType[],
  );
  const tl: Tile[] = cs.map((c, i) => ({ type: ty[i]!, cont: c }));
  const v = tl.find((t) => t.cont === "volc")!;
  if (v.type !== "m") {
    const m = tl.find((t) => t.type === "m")!;
    [m.cont, v.cont] = [v.cont, m.cont];
  }
  shuffle(S, LAND).forEach((k, i) => {
    S.tiles[k] = tl[i]!;
  });
  let id = 0;
  for (let o = 0; o < n; o++)
    NUMS.forEach((m) =>
      S.people.push({ id: id++, o, n: m, loc: { t: "hand" } }),
    );
  SERP.forEach((k) => S.creat.push({ id: ++S.id, t: "serp", k }));
  return S;
}

// ------------------------------------------------------------------ destinations (shared with the UI)

export function dests(
  S: BoardState,
  pl: number,
  sel?: Sel,
  mode?: string,
): string[] {
  sel = sel || {};
  const ph = S.phase;
  if (S.pending || S.over || pl !== S.cur) return [];
  if (ph === "setP")
    return Object.keys(S.tiles).filter(
      (k) => !S.people.some((p) => p.loc.t === "land" && p.loc.k === k),
    );
  if (ph === "setB")
    return CELLS.filter(
      (k) => isSea(S, k) && NB(k).some((x) => S.tiles[x]) && !boatAt(S, k),
    );
  const p = S.people.find((x) => x.id === sel!.p);
  const b = S.boats.find((x) => x.id === sel!.b);
  const c = S.creat.find((x) => x.id === sel!.c);
  const h = S.hands[pl]!;
  if (ph === "take") return cands(S);
  if (ph === "move" && S.moves > 0) {
    if (p && p.o === pl && ["land", "sea", "boat"].includes(p.loc.t))
      return opts(S, p).map((o) => o.k);
    if (b && canB(S, b, pl))
      return NB(b.k).filter((k) => isSea(S, k) && !boatAt(S, k));
  }
  if (ph === "play") {
    if (
      mode === "dolph" &&
      h.includes("dolph") &&
      p &&
      p.o === pl &&
      p.loc.t === "sea"
    )
      return reach(S, p.loc.k, 3);
    if (mode === "wind" && h.includes("wind") && b && canB(S, b, pl))
      return reach(S, b.k, 3).filter((k) => !boatAt(S, k));
    if (
      mode &&
      MV[mode] &&
      h.includes(mode as ContentType) &&
      c &&
      c.t === MV[mode]
    )
      return CELLS.filter((k) => empty(S, k));
  }
  if (ph === "creature" && c && c.t === S.roll) {
    return reach(
      S,
      c.k,
      RANGE[c.t],
      c.t === "shark"
        ? (k) => swim(S, k).length > 0
        : c.t === "whale"
          ? (k) => {
              const bb = boatAt(S, k);
              return !!bb && riders(S, bb).length > 0;
            }
          : undefined,
    );
  }
  return [];
}

// ------------------------------------------------------------------ turn helpers

const nextWith = (S: State, f: (o: number) => boolean): number => {
  for (let i = 1; i <= S.n; i++) {
    const o = (S.cur + i) % S.n;
    if (f(o)) return o;
  }
  return -1;
};
function startTurn(S: State, ev: Ev[]): void {
  S.phase = "play";
  S.moves = 3;
  S.undo = [];
  S.roll = null;
  ev.push({ type: "turn", cur: S.cur });
}
function endGame(S: State, ev: Ev[]): void {
  S.over = true;
  S.phase = "end";
  S.result = [...Array(S.n).keys()].map((o) => {
    const nums = S.people
      .filter((p) => p.o === o && p.loc.t === "safe")
      .map((p) => p.n);
    return { o, nums, total: nums.reduce((a, b) => a + b, 0) };
  });
  ev.push({ type: "end" });
}
function boatArrive(S: State, b: Boat, ev: Ev[]): void {
  if (!riders(S, b).length) return;
  const k = b.k;
  if (crAt(S, k, ["serp"]).length) {
    sink(S, b, false);
    ev.push({ type: "devoured", k });
  } else if (crAt(S, k, ["whale"]).length) {
    sink(S, b, true);
    hazard(S, k);
    ev.push({ type: "capsize", k });
  }
}
function finish(S: State, c: Creature, ev: Ev[]): void {
  const k = c.k;
  if (c.t === "whale") {
    const b = boatAt(S, k);
    if (b && riders(S, b).length) {
      sink(S, b, true);
      hazard(S, k);
      ev.push({ type: "capsize", k });
    }
  } else {
    swim(S, k).forEach(die);
    if (c.t === "serp") {
      const b = boatAt(S, k);
      if (b && riders(S, b).length) {
        sink(S, b, false);
        ev.push({ type: "devoured", k });
      }
    }
  }
}
function arrive(S: State, c: Creature, k: string, mv: number, ev: Ev[]): void {
  c.k = k;
  let q: number[] = [];
  let tile: "rshark" | "rwhale" | undefined;
  if (c.t === "whale") {
    const b = boatAt(S, k);
    if (b && riders(S, b).length) {
      q = own(S, b).filter((o) => o !== mv);
      tile = "rwhale";
    }
  } else if (c.t === "shark") {
    q = [...new Set(swim(S, k).map((p) => p.o))].filter((o) => o !== mv);
    tile = "rshark";
  }
  if (q.length) S.pending = { c: c.id, k, mover: mv, queue: q, tile: tile! };
  else finish(S, c, ev);
}

// ------------------------------------------------------------------ apply

export function apply(S0: State, pl: number, a: Action): ApplyResult {
  const S: State = JSON.parse(JSON.stringify(S0));
  const ev: Ev[] = [];
  const err = (m: string): ApplyResult => ({ error: m });
  const ok = (): ApplyResult => ({ state: S, events: ev });
  const act = a as unknown as {
    t: string;
    p?: number;
    b?: number;
    c?: number;
    to?: string;
    k?: string;
    id?: number;
    tile?: ContentType;
    play?: boolean;
  };
  if (S.over) return err("بازی تمام شده");
  const ph = S.phase;

  if (act.t === "defend") {
    const pd = S.pending;
    if (!pd || pd.queue[0] !== pl) return err("نوبت تصمیم تو نیست");
    const c = S.creat.find((x) => x.id === pd.c)!;
    const h = S.hands[pl]!;
    if (act.play && h.includes(pd.tile)) {
      h.splice(h.indexOf(pd.tile), 1);
      ev.push({ type: "defended", pl, tile: pd.tile });
      S.creat = S.creat.filter((x) => x !== c);
      S.pending = null;
      S.cur = pd.mover;
      S.cur = (S.cur + 1) % S.n;
      startTurn(S, ev);
      return ok();
    }
    pd.queue.shift();
    if (!pd.queue.length) {
      S.pending = null;
      finish(S, c, ev);
      S.cur = (S.cur + 1) % S.n;
      startTurn(S, ev);
    }
    return ok();
  }
  if (S.pending) return err("منتظر تصمیم دفاعی");
  if (act.t === "undo") {
    if (pl !== S.cur || !S.undo.length) return err("چیزی برای برگرداندن نیست");
    const u = S.undo;
    const R: State = JSON.parse(u.pop()!);
    R.undo = u;
    return { state: R, events: [] };
  }
  if (pl !== S.cur) return err("نوبت تو نیست");

  const snap = (): void => {
    S.undo.push(JSON.stringify({ ...S, undo: null }));
  };
  const D = (): boolean =>
    dests(
      S,
      pl,
      { p: act.p, b: act.b, c: act.c },
      act.t === "mcreat" ? act.tile : act.t,
    ).includes(act.to || act.k!);
  const useTile = (t: ContentType): void => {
    S.hands[pl]!.splice(S.hands[pl]!.indexOf(t), 1);
    S.phase = "move";
  };

  switch (act.t) {
    case "placePerson": {
      if (ph !== "setP" || !dests(S, pl).includes(act.k!))
        return err("خانه‌ی نامعتبر");
      const m = S.people.filter((p) => p.o === pl && p.loc.t === "hand");
      const p = m.find((x) => x.id === act.id) || m[0]!;
      p.loc = { t: "land", k: act.k! };
      const nx = nextWith(S, (q) =>
        S.people.some((x) => x.o === q && x.loc.t === "hand"),
      );
      if (nx < 0) {
        S.phase = "setB";
        S.cur = 0;
      } else S.cur = nx;
      return ok();
    }
    case "placeBoat": {
      if (ph !== "setB" || !dests(S, pl).includes(act.k!))
        return err("خانه‌ی نامعتبر");
      S.boats.push({ id: ++S.id, k: act.k! });
      S.boatsLeft[pl]!--;
      const nx = nextWith(S, (q) => S.boatsLeft[q]! > 0);
      if (nx < 0) {
        S.cur = 0;
        startTurn(S, ev);
      } else S.cur = nx;
      return ok();
    }
    case "skipTile":
      if (ph !== "play") return err("الان نه");
      S.phase = "move";
      return ok();
    case "dolph": {
      if (ph !== "play" || !D()) return err("حرکت نامعتبر");
      snap();
      const p = S.people.find((x) => x.id === act.p)!;
      p.loc = { t: "sea", k: act.to! };
      hazard(S, act.to!);
      useTile("dolph");
      return ok();
    }
    case "wind": {
      if (ph !== "play" || !D()) return err("حرکت نامعتبر");
      snap();
      const b = S.boats.find((x) => x.id === act.b)!;
      b.k = act.to!;
      boatArrive(S, b, ev);
      useTile("wind");
      return ok();
    }
    case "mcreat": {
      if (ph !== "play" || !D()) return err("حرکت نامعتبر");
      snap();
      S.creat.find((x) => x.id === act.c)!.k = act.to!;
      useTile(act.tile!);
      return ok();
    }
    case "movePerson": {
      if (ph !== "move" || !D()) return err("حرکت نامعتبر");
      snap();
      const p = S.people.find((x) => x.id === act.p)!;
      const o = opts(S, p).find((x) => x.k === act.to)!;
      p.loc = o.to;
      S.moves--;
      if (o.to.t === "sea") hazard(S, o.to.k);
      if (o.to.t === "safe") ev.push({ type: "saved", pl });
      return ok();
    }
    case "moveBoat": {
      if (ph !== "move" || !D()) return err("حرکت نامعتبر");
      snap();
      const b = S.boats.find((x) => x.id === act.b)!;
      b.k = act.to!;
      S.moves--;
      boatArrive(S, b, ev);
      return ok();
    }
    case "endMoves":
      if (ph !== "move") return err("الان نه");
      S.phase = "take";
      S.undo = [];
      return ok();
    case "take": {
      if (ph !== "take" || !D()) return err("کاشی نامعتبر");
      const k = act.k!;
      const t = S.tiles[k]!;
      const c = t.cont;
      delete S.tiles[k];
      S.undo = [];
      S.people
        .filter((p) => p.loc.t === "land" && p.loc.k === k)
        .forEach((p) => {
          p.loc = { t: "sea", k };
        });
      ev.push(
        { type: "reveal", to: pl, cont: c, k },
        { type: "took", pl, k, cont: PUBLIC.includes(c) ? c : null },
      );
      if (c === "shark" || c === "whale") {
        S.creat.push({ id: ++S.id, t: c, k });
        hazard(S, k);
      } else if (c === "boat") {
        const b: Boat = { id: ++S.id, k };
        S.boats.push(b);
        swim(S, k)
          .sort((x, y) => (y.o === pl ? 1 : 0) - (x.o === pl ? 1 : 0))
          .slice(0, 3)
          .forEach((p) => {
            p.loc = { t: "boat", b: b.id };
          });
      } else if (c === "whirl") {
        const ks = [k, ...NB(k).filter((x) => isSea(S, x))];
        S.people.forEach((p) => {
          if (["sea", "boat"].includes(p.loc.t) && ks.includes(pk(S, p)))
            die(p);
        });
        S.boats = S.boats.filter((b) => !ks.includes(b.k));
        S.creat = S.creat.filter((x) => !ks.includes(x.k));
      } else if (c === "volc") {
        endGame(S, ev);
        return ok();
      } else S.hands[pl]!.push(c);
      S.phase = "roll";
      return ok();
    }
    case "roll":
      if (ph !== "roll") return err("الان نه");
      S.roll = DIE[Math.floor(rand(S) * 6)]!;
      S.phase = "creature";
      ev.push({ type: "roll", pl, face: S.roll });
      return ok();
    case "moveCreature": {
      if (ph !== "creature" || !D()) return err("حرکت نامعتبر");
      const c = S.creat.find((x) => x.id === act.c)!;
      ev.push({ type: "cmove", pl, t: c.t });
      arrive(S, c, act.to!, pl, ev);
      if (!S.pending) {
        S.cur = (S.cur + 1) % S.n;
        startTurn(S, ev);
      }
      return ok();
    }
    case "skipCreature":
      if (ph !== "creature") return err("الان نه");
      S.cur = (S.cur + 1) % S.n;
      startTurn(S, ev);
      return ok();
  }
  return err("اکشن ناشناخته");
}

// ------------------------------------------------------------------ view (per-player, hides secrets)

export function view(S: State, pl: number): ViewState {
  const V: any = JSON.parse(JSON.stringify(S));
  V.me = pl;
  V.canUndo = pl === S.cur && S.undo.length > 0;
  delete V.undo;
  delete V.seed;
  for (const k in V.tiles) V.tiles[k] = { type: V.tiles[k].type };
  V.people.forEach((p: PersonView) => {
    if (p.o !== pl && !S.over) p.n = null;
  });
  V.hands = V.hands.map((h: ContentType[], o: number) =>
    o === pl ? h : h.map(() => null),
  );
  return V as ViewState;
}

// ------------------------------------------------------------------ api

const api = {
  W,
  H,
  SAFE,
  DOCK,
  SERP,
  CELLS,
  LAND,
  NB,
  kk,
  P,
  MV,
  PUBLIC,
  newGame,
  apply,
  view,
  dests,
  cands,
  pk,
};
export default api;

// Keep a global handle for non-module consumers (e.g. the built browser bundle).
(globalThis as unknown as { Atlantis: typeof api }).Atlantis = api;
