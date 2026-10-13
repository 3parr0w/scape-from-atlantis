"use strict";
// Rule-level unit tests for src/engine.ts. Complements fuzz (which is random): here we assert
// exact behaviour for setup, turns, movement, tiles, creatures, defence windows, view secrecy, scoring.
import A0 from "../src/engine.js";

// Wrap apply() so tests can read both `.state` and `.error` without narrowing the result union.
// (On error we return the input state so a follow-up assertion still has a usable value.)
const A: any = Object.assign({}, A0, {
  apply: (S: any, pl: any, a: any): any => {
    const r = A0.apply(S, pl, a);
    return "error" in r ? { state: S, events: [], error: r.error } : r;
  },
});

type Chk = {
  q: (c: unknown, m: string) => void;
  eq: (a: unknown, b: unknown, m: string) => void;
};

let pass = 0,
  fail = 0,
  cur: string[] | null = null;
const q = (c: unknown, m: string): void => {
  if (!c) cur!.push(m);
};
const eq = (a: unknown, b: unknown, m: string): void => {
  const x = JSON.stringify(a),
    y = JSON.stringify(b);
  if (x !== y) cur!.push(m + " (got " + x + ", want " + y + ")");
};
function test(name: string, fn: (c: Chk) => void): void {
  cur = [];
  try {
    fn({ q, eq });
  } catch (e) {
    cur.push("threw: " + (e as Error).message);
  }
  if (cur.length) {
    fail++;
    console.log("✗ " + name);
    cur.forEach((m) => console.log("    - " + m));
  } else {
    pass++;
    console.log("✓ " + name);
  }
}

// Minimal hand-built state (all empty cells are open sea) for precise scenarios.
const st = (o) =>
  Object.assign(
    {
      n: 2,
      seed: 1,
      tiles: {},
      people: [],
      boats: [],
      creat: [],
      hands: [[], []],
      boatsLeft: [0, 0],
      cur: 0,
      phase: "move",
      moves: 3,
      roll: null,
      pending: null,
      over: false,
      result: null,
      undo: [],
      id: 100,
    },
    o || {},
  );

// Drive a fresh game through setup and return the state at the first player's first turn.
function toPlay(n, seed) {
  let S = A.newGame(n, seed),
    g = 0;
  while (S.phase === "setP" || S.phase === "setB") {
    const ph = S.phase;
    const a =
      ph === "setP"
        ? { t: "placePerson", k: A.dests(S, S.cur)[0] }
        : { t: "placeBoat", k: A.dests(S, S.cur)[0] };
    const r = A.apply(S, S.cur, a);
    if (r.error) throw new Error("setup " + ph + ": " + r.error);
    S = r.state;
    if (++g > 500) throw new Error("setup did not terminate");
  }
  return S;
}

// ---------------------------------------------------------------- geometry / constants

test("hex helpers are consistent", ({ q, eq }) => {
  eq(A.kk(3, 4), "3,4", "kk");
  eq(A.P("3,4"), [3, 4], "P");
  q(A.NB("0,0").length === 2, "corner has 2 neighbours");
  q(A.NB("5,5").length === 6, "interior has 6 neighbours");
  for (const k of A.CELLS)
    for (const n of A.NB(k))
      q(A.NB(n).includes(k), "NB symmetric " + k + "->" + n);
  for (const k of A.CELLS)
    for (const n of A.NB(k)) q(A.CELLS.includes(n), "NB in bounds " + n);
});

test("board constants match the rules", ({ q, eq }) => {
  eq(A.CELLS.length, A.W * A.H, "cell count");
  eq(A.LAND.length, 40, "40 island tiles");
  eq(A.SAFE.length, 4, "4 safe islands");
  eq(Object.keys(A.DOCK).length, 8, "8 docking cells");
  eq(A.SERP.length, 5, "5 sea serpents");
  eq(Object.keys(A.MV).length, 3, "tile->creature map");
});

// ---------------------------------------------------------------- setup / dealing

test("newGame deals a legal opening position", ({ q, eq }) => {
  const S = A.newGame(4, 12345);
  eq(S.n, 4, "player count");
  eq(S.phase, "setP", "starts placing people");
  eq(S.cur, 0, "first player");
  eq(S.moves, 3, "three moves");
  eq(S.people.length, 40, "40 people");
  q(
    S.people.every((p) => p.loc.t === "hand"),
    "all people in hand",
  );
  eq(S.hands.length, 4, "four hands");
  q(
    S.hands.every((h) => h.length === 0),
    "hands empty",
  );
  eq(S.boatsLeft, [2, 2, 2, 2], "two boats each");
  eq(S.boats.length, 0, "no boats on board yet");
  eq(S.creat.length, 5, "five sea serpents");
  q(
    S.creat.every((c) => c.t === "serp" && A.SERP.includes(c.k)),
    "serpents on marked cells",
  );
  const ids = S.people.map((p) => p.id);
  eq(new Set(ids).size, 40, "unique person ids");
});

test("every land cell holds a tile with the right type mix", ({ q, eq }) => {
  const S = A.newGame(3, 42);
  q(
    A.LAND.every((k) => S.tiles[k]),
    "all land has a tile",
  );
  eq(Object.keys(S.tiles).length, 40, "40 tiles");
  const type = (t: string) =>
    Object.values(S.tiles).filter((x: any) => x.type === t).length;
  eq(
    { b: type("b"), f: type("f"), m: type("m") },
    { b: 16, f: 16, m: 8 },
    "16 coast / 16 forest / 8 mountain",
  );
});

test("tile contents match the inventory and the volcano is a mountain", ({
  q,
  eq,
}) => {
  const S = A.newGame(2, 7);
  const conts: Record<string, number> = {};
  for (const k in S.tiles)
    conts[S.tiles[k].cont] = (conts[S.tiles[k].cont] || 0) + 1;
  const want = {
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
  };
  for (const c in want) eq(conts[c] || 0, want[c], "count of " + c);
  eq(Object.keys(conts).length, Object.keys(want).length, "no extra contents");
  const volc: any = Object.values(S.tiles as Record<string, any>).find(
    (t) => t.cont === "volc",
  );
  q(!!volc && volc.type === "m", "volcano is under a mountain");
});

test("person numbers are 1..6 with the standard distribution", ({ q, eq }) => {
  const S = A.newGame(4, 99);
  const per = S.people
    .filter((p) => p.o === 0)
    .map((p) => p.n)
    .sort((a, b) => a - b);
  eq(
    per,
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 6],
    "each player holds 1,1,2,2,3,3,4,4,5,6",
  );
  const all = S.people.map((p) => p.n);
  q(
    all.every((n) => n >= 1 && n <= 6),
    "numbers in range",
  );
});

test("the same seed deals the same game; different seeds differ", ({ eq }) => {
  eq(A.newGame(3, 999), A.newGame(3, 999), "deterministic");
  q(
    JSON.stringify(A.newGame(3, 1).tiles) !==
      JSON.stringify(A.newGame(3, 2).tiles),
    "seeds differ",
  );
});

// ---------------------------------------------------------------- placement phases

test("placement turn order cycles through all players", ({ eq }) => {
  let S = A.newGame(3, 3),
    order = [];
  while (S.phase === "setP") {
    order.push(S.cur);
    S = A.apply(S, S.cur, { t: "placePerson", k: A.dests(S, S.cur)[0] }).state;
  }
  eq(order.slice(0, 9), [0, 1, 2, 0, 1, 2, 0, 1, 2], "round robin");
  eq(order.length, 30, "30 placements for 3 players");
});

test("placing a person marks the tile and advances the turn", ({ q, eq }) => {
  const S0 = A.newGame(2, 1);
  const k = A.dests(S0, 0)[0];
  const id = S0.people.find((p) => p.o === 0 && p.loc.t === "hand").id;
  const r = A.apply(S0, 0, { t: "placePerson", k, id });
  q(!r.error, "accepted");
  eq(
    r.state.people.find((p) => p.id === id).loc,
    { t: "land", k },
    "person on tile",
  );
  eq(r.state.cur, 1, "turn passed");
});

test("placement rejects invalid cells and out-of-turn players", ({ q }) => {
  const S = A.newGame(2, 1);
  q(A.apply(S, 0, { t: "placePerson", k: "0,0" }).error, "sea cell rejected");
  q(
    A.apply(S, 0, { t: "placePerson", k: "29,29" }).error,
    "off-board rejected",
  );
  q(
    A.apply(S, 1, { t: "placePerson", k: A.dests(S, 0)[0] }).error,
    "out of turn rejected",
  );
  const k = A.dests(S, 0)[0];
  const r = A.apply(S, 0, { t: "placePerson", k });
  q(
    A.apply(r.state, 1, { t: "placePerson", k }).error,
    "occupied tile rejected",
  );
});

test("after setup every person is on land and every boat is on water beside land", ({
  q,
  eq,
}) => {
  const S = toPlay(4, 21);
  eq(S.phase, "play", "play phase");
  eq(S.cur, 0, "first player starts");
  eq(S.people.length, 40, "40 people");
  q(
    S.people.every((p) => p.loc.t === "land"),
    "all on land",
  );
  eq(S.boats.length, 8, "4 players x 2 boats");
  q(
    S.boats.every((b) => !S.tiles[b.k] && !A.SAFE.includes(b.k)),
    "boats on open sea",
  );
  q(
    S.boats.every((b) => A.NB(b.k).some((x) => S.tiles[x])),
    "each boat touches land",
  );
  eq(S.boatsLeft, [0, 0, 0, 0], "no boats left to place");
});

// ---------------------------------------------------------------- tile selection

test("cands prefers coast, then forest, then mountain", ({ q, eq }) => {
  const S = A.newGame(2, 1);
  const sea = (k) => !S.tiles[k] && !A.SAFE.includes(k);
  const coasts = Object.keys(S.tiles).filter(
    (k) => S.tiles[k].type === "b" && A.NB(k).some(sea),
  );
  q(coasts.length > 0, "there are coastal candidates");
  eq(A.cands(S), coasts, "coast candidates returned first");
  q(
    A.cands(S).every((k) => S.tiles[k].type === "b"),
    "no forest/mountain while coast remains",
  );
});

test("take-phase destinations equal cands", ({ q, eq }) => {
  const S = A.newGame(2, 1);
  S.phase = "take";
  S.cur = 0;
  const d = A.dests(S, 0);
  eq(d, A.cands(S), "same set");
  S.cur = 1;
  eq(A.dests(S, 0), [], "no destinations out of turn");
});

// ---------------------------------------------------------------- movement & undo

test("skipTile then move then undo restores state", ({ q, eq }) => {
  let S = toPlay(3, 11);
  S = A.apply(S, 0, { t: "skipTile" }).state;
  eq(S.phase, "move", "move phase");
  q(A.apply(S, 0, { t: "undo" }).error, "nothing to undo yet");
  const p = S.people.find((x) => x.o === 0);
  const d = A.dests(S, 0, { p: p.id });
  q(d.length > 0, "has legal moves");
  const r = A.apply(S, 0, { t: "movePerson", p: p.id, to: d[0] });
  q(!r.error, "move accepted");
  eq(r.state.moves, 2, "one move used");
  const r2 = A.apply(r.state, 0, { t: "undo" });
  q(!r2.error, "undo accepted");
  eq(r2.state.moves, 3, "moves restored");
  eq(
    r2.state.people.find((x) => x.id === p.id).loc,
    p.loc,
    "position restored",
  );
  q(A.apply(r.state, 1, { t: "undo" }).error, "another player can't undo");
});

test("moving a person onto open sea makes a swimmer (hazard applies)", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "move",
    tiles: { "8,5": { type: "b", cont: "dolph" } },
    people: [{ id: 1, o: 0, n: 3, loc: { t: "land", k: "8,5" } }],
  });
  const d = A.dests(S, 0, { p: 1 });
  const seaTo = d.find((k) => !S.tiles[k] && !A.SAFE.includes(k));
  q(!!seaTo, "a sea destination exists");
  const r = A.apply(S, 0, { t: "movePerson", p: 1, to: seaTo });
  eq(r.state.people[0].loc, { t: "sea", k: seaTo }, "now swimming");
});

test("a person cannot move back onto land once at sea", ({ q }) => {
  const S = st({
    phase: "move",
    tiles: {
      "8,5": { type: "b", cont: "dolph" },
      "7,5": { type: "b", cont: "dolph" },
    },
    people: [{ id: 1, o: 0, n: 3, loc: { t: "sea", k: "8,5" } }],
  });
  q(
    !A.dests(S, 0, { p: 1 }).includes("7,5"),
    "land neighbour not offered to swimmer",
  );
});

test("you cannot move another player's person", ({ q }) => {
  const S = st({
    phase: "move",
    people: [
      { id: 101, o: 1, n: 1, loc: { t: "sea", k: "8,5" } },
      { id: 102, o: 0, n: 1, loc: { t: "sea", k: "9,5" } },
    ],
  });
  eq(A.dests(S, 0, { p: 101 }), [], "no destinations for foreign person");
  q(
    A.apply(S, 0, { t: "movePerson", p: 101, to: "9,5" }).error,
    "move rejected",
  );
});

test("a swimmer can board a boat in the same cell but not a full one", ({
  q,
  eq,
}) => {
  const ok = st({
    phase: "move",
    boats: [{ id: 50, k: "8,5" }],
    people: [{ id: 1, o: 0, n: 2, loc: { t: "sea", k: "8,5" } }],
  });
  q(A.dests(ok, 0, { p: 1 }).includes("8,5"), "can board");
  eq(
    A.apply(ok, 0, { t: "movePerson", p: 1, to: "8,5" }).state.people[0].loc,
    { t: "boat", b: 50 },
    "boarded",
  );
  const full = st({
    phase: "move",
    boats: [{ id: 50, k: "8,5" }],
    people: [
      { id: 1, o: 0, n: 1, loc: { t: "boat", b: 50 } },
      { id: 2, o: 0, n: 1, loc: { t: "boat", b: 50 } },
      { id: 3, o: 0, n: 1, loc: { t: "boat", b: 50 } },
      { id: 4, o: 0, n: 1, loc: { t: "sea", k: "8,5" } },
    ],
  });
  q(!A.dests(full, 0, { p: 4 }).includes("8,5"), "full boat not boardable");
});

test("boat control: majority owner moves it, ties allow both, empty boats are free", ({
  q,
}) => {
  const mk = (people) =>
    st({ phase: "move", boats: [{ id: 50, k: "8,5" }], people });
  const maj = mk([
    { id: 1, o: 0, n: 1, loc: { t: "boat", b: 50 } },
    { id: 2, o: 0, n: 1, loc: { t: "boat", b: 50 } },
    { id: 3, o: 1, n: 1, loc: { t: "boat", b: 50 } },
  ]);
  q(
    A.dests({ ...maj, cur: 0 }, 0, { b: 50 }).length > 0,
    "majority owner can move",
  );
  eq(A.dests({ ...maj, cur: 1 }, 1, { b: 50 }), [], "minority owner cannot");
  const tie = mk([
    { id: 1, o: 0, n: 1, loc: { t: "boat", b: 50 } },
    { id: 2, o: 1, n: 1, loc: { t: "boat", b: 50 } },
  ]);
  q(
    A.dests({ ...tie, cur: 0 }, 0, { b: 50 }).length > 0 &&
      A.dests({ ...tie, cur: 1 }, 1, { b: 50 }).length > 0,
    "tie allows both",
  );
  q(
    A.dests({ ...mk([]), cur: 1 }, 1, { b: 50 }).length > 0,
    "empty boat is free",
  );
});

test("boats cannot stack on one sea cell", ({ q }) => {
  const S = st({
    phase: "move",
    boats: [
      { id: 50, k: "9,5" },
      { id: 51, k: "10,5" },
    ],
  });
  q(!A.dests(S, 0, { b: 50 }).includes("10,5"), "occupied cell excluded");
});

test("landing on a safe island scores a saved person", ({ q, eq }) => {
  const S = st({
    phase: "move",
    boats: [{ id: 50, k: "1,0" }],
    people: [{ id: 101, o: 0, n: 6, loc: { t: "boat", b: 50 } }],
  });
  q(A.dests(S, 0, { p: 101 }).includes("0,0"), "dock offered");
  const r = A.apply(S, 0, { t: "movePerson", p: 101, to: "0,0" });
  q(
    r.events.some((e) => e.type === "saved" && e.pl === 0),
    "saved event",
  );
  eq(r.state.people[0].loc, { t: "safe" }, "now safe");
});

// ---------------------------------------------------------------- playing hand tiles

test("playing a dolphin moves a swimmer up to 3 and consumes the tile", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "play",
    hands: [["dolph"], []],
    people: [{ id: 1, o: 0, n: 1, loc: { t: "sea", k: "5,0" } }],
  });
  const d = A.dests(S, 0, { p: 1 }, "dolph");
  q(d.length > 0, "has dolphin destinations");
  const r = A.apply(S, 0, { t: "dolph", p: 1, to: d[0] });
  q(!r.error, "accepted");
  eq(r.state.hands[0], [], "tile consumed");
  eq(r.state.phase, "move", "continues to movement");
  eq(r.state.people[0].loc, { t: "sea", k: d[0] }, "swimmer moved");
});

test("a favourable-wind tile moves a controlled boat", ({ q, eq }) => {
  const S = st({
    phase: "play",
    hands: [["wind"], []],
    boats: [{ id: 50, k: "8,5" }],
    people: [{ id: 1, o: 0, n: 1, loc: { t: "boat", b: 50 } }],
  });
  const d = A.dests(S, 0, { b: 50 }, "wind");
  q(d.length > 0, "has wind destinations");
  const r = A.apply(S, 0, { t: "wind", b: 50, to: d[0] });
  q(!r.error, "accepted");
  eq(r.state.boats[0].k, d[0], "boat moved");
  eq(r.state.hands[0], [], "tile consumed");
});

test("a creature-move tile only reaches empty sea cells", ({ q }) => {
  const S = st({
    phase: "play",
    hands: [["mshark"], []],
    creat: [{ id: 1, t: "shark", k: "5,0" }],
  });
  const d = A.dests(S, 0, { c: 1 }, "mshark");
  q(d.includes("8,5"), "empty sea reachable");
  S.boats = [{ id: 50, k: "8,5" }];
  q(
    !A.dests(S, 0, { c: 1 }, "mshark").includes("8,5"),
    "occupied cell not reachable",
  );
  q(
    !A.dests(S, 0, { c: 1 }, "mserp").includes("8,5"),
    "wrong tile for creature type",
  );
});

test("tiles cannot be played out of turn or in the wrong phase", ({ q }) => {
  const S = st({
    phase: "play",
    cur: 0,
    hands: [["dolph"], []],
    people: [{ id: 1, o: 0, n: 1, loc: { t: "sea", k: "5,0" } }],
  });
  const to = A.dests(S, 0, { p: 1 }, "dolph")[0];
  q(A.apply(S, 1, { t: "dolph", p: 1, to }).error, "out of turn rejected");
  const moveS = st({
    phase: "move",
    hands: [["dolph"], []],
    people: [{ id: 1, o: 0, n: 1, loc: { t: "sea", k: "5,0" } }],
  });
  q(
    A.apply(moveS, 0, { t: "dolph", p: 1, to: "6,0" }).error,
    "wrong phase rejected",
  );
});

// ---------------------------------------------------------------- taking tiles

test("taking a hidden tile goes to hand and is revealed only to the actor", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "take",
    tiles: { "8,5": { type: "b", cont: "dolph" } },
  });
  const r = A.apply(S, 0, { t: "take", k: "8,5" });
  q(!r.error, "accepted");
  eq(r.state.hands[0], ["dolph"], "hand received the dolphin");
  const took = r.events.find((e) => e.type === "took");
  eq(took.cont, null, "public log hides the content");
  const rev = r.events.find((e) => e.type === "reveal");
  q(rev.to === 0 && rev.cont === "dolph", "reveal addressed to the taker only");
  eq(r.state.phase, "roll", "advances to the creature roll");
});

test("a shark tile becomes a shark and kills swimmers in the cell", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "take",
    tiles: { "8,5": { type: "b", cont: "shark" } },
    people: [{ id: 1, o: 1, n: 5, loc: { t: "sea", k: "8,5" } }],
  });
  const r = A.apply(S, 0, { t: "take", k: "8,5" });
  q(
    r.state.creat.some((c) => c.t === "shark" && c.k === "8,5"),
    "shark placed",
  );
  eq(r.state.people[0].loc.t, "dead", "swimmer eaten");
  eq(
    r.events.find((e) => e.type === "took").cont,
    "shark",
    "public effect is announced",
  );
});

test("a boat tile collects up to 3 swimmers, preferring the taker", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "take",
    tiles: { "8,5": { type: "b", cont: "boat" } },
    people: [
      { id: 1, o: 0, n: 1, loc: { t: "sea", k: "8,5" } },
      { id: 2, o: 1, n: 2, loc: { t: "sea", k: "8,5" } },
      { id: 3, o: 1, n: 3, loc: { t: "sea", k: "8,5" } },
      { id: 4, o: 1, n: 4, loc: { t: "sea", k: "8,5" } },
    ],
  });
  const r = A.apply(S, 0, { t: "take", k: "8,5" });
  eq(r.state.boats.length, 1, "one boat created");
  eq(
    r.state.people.filter((p) => p.loc.t === "boat").length,
    3,
    "three aboard",
  );
  q(
    r.state.people.find((p) => p.id === 1).loc.t === "boat",
    "taker boards first",
  );
  eq(
    r.state.people.filter((p) => p.loc.t === "sea").length,
    1,
    "one left swimming",
  );
});

test("a whirlpool destroys the cell and its sea neighbours", ({ q, eq }) => {
  const S = st({
    phase: "take",
    tiles: { "8,5": { type: "b", cont: "whirl" } },
    boats: [{ id: 50, k: "8,5" }],
    creat: [{ id: 1, t: "shark", k: "9,5" }],
    people: [
      { id: 1, o: 0, n: 1, loc: { t: "sea", k: "8,5" } },
      { id: 2, o: 1, n: 2, loc: { t: "sea", k: "9,5" } },
      { id: 3, o: 1, n: 3, loc: { t: "land", k: "8,5" } },
    ],
  });
  const r = A.apply(S, 0, { t: "take", k: "8,5" });
  q(
    r.state.people.every((p) => p.loc.t === "dead"),
    "everyone in range dies",
  );
  eq(r.state.boats.length, 0, "boat swept away");
  eq(r.state.creat.length, 0, "creature swept away");
});

test("the volcano tile ends the game and scores saved people", ({ q, eq }) => {
  const S = st({
    phase: "take",
    cur: 0,
    tiles: { "8,5": { type: "b", cont: "volc" } },
    people: [
      { id: 900, o: 0, n: 6, loc: { t: "safe" } },
      { id: 901, o: 0, n: 2, loc: { t: "safe" } },
      { id: 902, o: 1, n: 5, loc: { t: "safe" } },
    ],
  });
  const r = A.apply(S, 0, { t: "take", k: "8,5" });
  q(!r.error, "accepted");
  q(r.state.over === true && r.state.phase === "end", "game over");
  q(
    r.events.some((e) => e.type === "end"),
    "end event",
  );
  eq(
    r.state.result.map((x) => x.total),
    [8, 5],
    "totals are sums of saved numbers",
  );
  eq(r.state.result[0].nums, [6, 2], "individual scores");
  q(A.apply(r.state, 0, { t: "roll" }).error, "no actions after the game ends");
});

// ---------------------------------------------------------------- creature dice & moving

test("a full turn runs play -> move -> take -> roll -> creature -> next player", ({
  q,
  eq,
}) => {
  let S = toPlay(2, 5);
  S = A.apply(S, 0, { t: "skipTile" }).state;
  eq(S.phase, "move", "move");
  S = A.apply(S, 0, { t: "endMoves" }).state;
  eq(S.phase, "take", "take");
  S = A.apply(S, 0, { t: "take", k: A.dests(S, 0)[0] }).state;
  eq(S.phase, "roll", "roll (first tile is never the volcano)");
  S = A.apply(S, 0, { t: "roll" }).state;
  eq(S.phase, "creature", "creature");
  q(["serp", "shark", "whale"].includes(S.roll), "die face is a creature");
  S = A.apply(S, 0, { t: "skipCreature" }).state;
  eq(S.phase, "play", "next turn");
  eq(S.cur, 1, "turn passed");
});

test("actions are rejected in the wrong phase or out of turn", ({ q }) => {
  const S = toPlay(2, 7);
  q(A.apply(S, 1, { t: "skipTile" }).error, "out of turn");
  q(A.apply(S, 0, { t: "roll" }).error, "roll too early");
  q(A.apply(S, 0, { t: "endMoves" }).error, "endMoves too early");
  q(A.apply(S, 0, { t: "take", k: A.dests(S, 0)[0] }).error, "take too early");
  q(A.apply(S, 0, { t: "skipCreature" }).error, "skipCreature too early");
  q(A.apply(S, 0, { t: "notAThing" }).error, "unknown action rejected");
});

test("creature movement range: serpent 1, shark 2, whale 3", ({ q, eq }) => {
  const sea = (k) => !A.SAFE.includes(k);
  const bfs = (start, n) => {
    const seen = { [start]: 0 },
      queue = [start],
      out = [];
    while (queue.length) {
      const u = queue.shift();
      if (seen[u] >= n) continue;
      for (const v of A.NB(u))
        if (sea(v) && seen[v] === undefined) {
          seen[v] = seen[u] + 1;
          queue.push(v);
          out.push(v);
        }
    }
    return out.sort();
  };
  for (const [t, range] of [
    ["serp", 1],
    ["shark", 2],
    ["whale", 3],
  ]) {
    const S = st({
      phase: "creature",
      roll: t,
      creat: [{ id: 1, t, k: "8,5" }],
    });
    const d = A.dests(S, 0, { c: 1 }).sort();
    eq(d, bfs("8,5", range), t + " reaches exactly a range-" + range + " set");
    q(!d.includes("8,5"), t + " current cell not listed as a move");
  }
});

test("serpent devours an occupied boat", ({ q, eq }) => {
  const S = st({
    phase: "creature",
    roll: "serp",
    creat: [{ id: 1, t: "serp", k: "9,5" }],
    boats: [{ id: 50, k: "8,5" }],
    people: [{ id: 101, o: 0, n: 1, loc: { t: "boat", b: 50 } }],
  });
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "8,5" });
  q(
    r.events.some((e) => e.type === "devoured"),
    "devoured event",
  );
  eq(r.state.boats.length, 0, "boat gone");
  eq(r.state.people[0].loc.t, "dead", "rider dead");
  q(!r.state.pending, "no defence for serpents");
});

test("sailing a boat into a serpent is fatal (empty boats are safe)", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "move",
    creat: [{ id: 1, t: "serp", k: "8,5" }],
    boats: [{ id: 50, k: "9,5" }],
    people: [{ id: 101, o: 0, n: 1, loc: { t: "boat", b: 50 } }],
  });
  const r = A.apply(S, 0, { t: "moveBoat", b: 50, to: "8,5" });
  q(
    r.events.some((e) => e.type === "devoured"),
    "devoured",
  );
  eq(r.state.people[0].loc.t, "dead", "rider dead");
  const S2 = st({
    phase: "move",
    creat: [{ id: 1, t: "serp", k: "8,5" }],
    boats: [{ id: 50, k: "9,5" }],
  });
  const r2 = A.apply(S2, 0, { t: "moveBoat", b: 50, to: "8,5" });
  eq(r2.state.boats.length, 1, "empty boat survives");
});

test("whale capsizes a boat: riders become swimmers", ({ q, eq }) => {
  const S = st({
    phase: "creature",
    roll: "whale",
    creat: [{ id: 1, t: "whale", k: "9,5" }],
    boats: [{ id: 50, k: "8,5" }],
    people: [
      { id: 101, o: 0, n: 3, loc: { t: "boat", b: 50 } },
      { id: 102, o: 0, n: 4, loc: { t: "boat", b: 50 } },
      { id: 103, o: 1, n: 5, loc: { t: "boat", b: 50 } },
    ],
  });
  q(A.dests(S, 0, { c: 1 }).includes("8,5"), "whale can reach the boat cell");
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "8,5" });
  q(
    r.events.some((e) => e.type === "capsize"),
    "capsize event",
  );
  eq(r.state.boats.length, 0, "boat removed");
  q(
    [101, 102, 103].every(
      (id) => r.state.people.find((p) => p.id === id).loc.t === "sea",
    ),
    "riders become swimmers",
  );
  q(!r.state.pending, "majority owner means no defence window");
});

test("whale onto a shark cell drowns the new swimmers", ({ q, eq }) => {
  const S = st({
    phase: "creature",
    roll: "whale",
    creat: [
      { id: 1, t: "whale", k: "9,5" },
      { id: 2, t: "shark", k: "8,5" },
    ],
    boats: [{ id: 50, k: "8,5" }],
    people: [
      { id: 101, o: 0, n: 3, loc: { t: "boat", b: 50 } },
      { id: 102, o: 0, n: 4, loc: { t: "boat", b: 50 } },
    ],
  });
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "8,5" });
  q(
    r.state.people.every((p) => p.loc.t === "dead"),
    "riders die with the shark present",
  );
});

// ---------------------------------------------------------------- defence windows

test("shark onto a swimmer opens a defence window for the victim", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "creature",
    roll: "shark",
    creat: [{ id: 1, t: "shark", k: "5,0" }],
    hands: [[], ["rshark"]],
    people: [{ id: 201, o: 1, n: 2, loc: { t: "sea", k: "6,0" } }],
  });
  const d = A.dests(S, 0, { c: 1 });
  q(d.includes("6,0"), "can enter the swimmer cell");
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "6,0" });
  q(
    r.state.pending && r.state.pending.tile === "rshark",
    "shark defence pending",
  );
  eq(r.state.pending.queue, [1], "victim is asked");
  q(
    A.apply(r.state, 0, { t: "defend", play: true }).error,
    "mover cannot answer",
  );
  q(
    A.apply(r.state, 0, { t: "roll" }).error,
    "other actions blocked while pending",
  );
  const r2 = A.apply(r.state, 1, { t: "defend", play: true });
  q(!r2.state.creat.some((c) => c.id === 1), "shark removed");
  eq(r2.state.people[0].loc.t, "sea", "swimmer survives");
  eq(r2.state.hands[1].length, 0, "defence tile consumed");
  eq(r2.state.phase, "play", "next turn begins");
});

test("declining shark defence lets the swimmer be eaten", ({ q, eq }) => {
  const S = st({
    phase: "creature",
    roll: "shark",
    creat: [{ id: 1, t: "shark", k: "5,0" }],
    people: [{ id: 201, o: 1, n: 2, loc: { t: "sea", k: "6,0" } }],
  });
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "6,0" });
  const r2 = A.apply(r.state, 1, { t: "defend", play: false });
  eq(r2.state.people[0].loc.t, "dead", "swimmer eaten");
  eq(r2.state.phase, "play", "turn resolved");
});

test("defence with play=true but no matching tile is treated as a pass", ({
  q,
  eq,
}) => {
  const S = st({
    phase: "creature",
    roll: "whale",
    creat: [{ id: 1, t: "whale", k: "9,5" }],
    boats: [{ id: 50, k: "8,5" }],
    people: [
      { id: 101, o: 0, n: 3, loc: { t: "boat", b: 50 } },
      { id: 102, o: 1, n: 5, loc: { t: "boat", b: 50 } },
    ],
  });
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "8,5" });
  const r2 = A.apply(r.state, 1, { t: "defend", play: true });
  eq(r2.state.boats.length, 0, "whale still capsizes");
});

test("whale defence saves a boat the player controls", ({ q, eq }) => {
  const S = st({
    phase: "creature",
    roll: "whale",
    creat: [{ id: 1, t: "whale", k: "9,5" }],
    boats: [{ id: 50, k: "8,5" }],
    hands: [[], ["rwhale"]],
    people: [
      { id: 101, o: 0, n: 3, loc: { t: "boat", b: 50 } },
      { id: 102, o: 1, n: 5, loc: { t: "boat", b: 50 } },
    ],
  });
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "8,5" });
  q(
    r.state.pending && r.state.pending.queue[0] === 1,
    "pending for the second owner",
  );
  const r2 = A.apply(r.state, 1, { t: "defend", play: true });
  q(!r2.error, "accepted");
  q(!r2.state.creat.some((c) => c.id === 1), "whale removed");
  eq(r2.state.boats.length, 1, "boat survives");
  eq(r2.state.cur, 1, "turn moves on");
});

// ---------------------------------------------------------------- view secrecy

test("view hides secrets: tile contents, opponent numbers, opponent hands, seed", ({
  q,
  eq,
}) => {
  const S = A.newGame(3, 8);
  S.hands[1] = ["dolph"];
  S.hands[2] = ["rwhale", "shark"];
  const v = A.view(S, 0);
  eq(v.me, 0, "me");
  q(!("seed" in v), "seed stripped");
  q(!("undo" in v), "undo stripped");
  for (const k in v.tiles)
    eq(Object.keys(v.tiles[k]), ["type"], "tile " + k + " has only type");
  q(
    v.people.filter((p) => p.o !== 0).every((p) => p.n === null),
    "opponent numbers hidden",
  );
  q(
    v.people.filter((p) => p.o === 0).every((p) => p.n >= 1 && p.n <= 6),
    "own numbers visible",
  );
  eq(v.hands[0], [], "own hand visible");
  q(
    v.hands[1].every((x) => x === null) && v.hands[2].every((x) => x === null),
    "opponent hands hidden",
  );
  q(
    JSON.stringify(v).indexOf('"cont"') === -1,
    "no tile contents anywhere in the view",
  );
});

test("view exposes a pending decision to everyone but still hides hands", ({
  q,
}) => {
  const S = st({
    phase: "creature",
    roll: "whale",
    creat: [{ id: 1, t: "whale", k: "9,5" }],
    boats: [{ id: 50, k: "8,5" }],
    hands: [[], ["rwhale"]],
    people: [
      { id: 101, o: 0, n: 3, loc: { t: "boat", b: 50 } },
      { id: 102, o: 1, n: 5, loc: { t: "boat", b: 50 } },
    ],
  });
  const r = A.apply(S, 0, { t: "moveCreature", c: 1, to: "8,5" });
  const v = A.view(r.state, 0);
  q(!!v.pending, "pending visible to all");
  q(
    v.hands[1].every((x) => x === null),
    "hands still hidden during a defence window",
  );
});

test("numbers are revealed only once the game is over", ({ q, eq }) => {
  const S = st({
    phase: "take",
    cur: 0,
    tiles: {
      "8,5": { type: "b", cont: "volc" },
      "7,5": { type: "b", cont: "dolph" },
    },
    people: [
      { id: 900, o: 0, n: 6, loc: { t: "safe" } },
      { id: 901, o: 1, n: 5, loc: { t: "safe" } },
    ],
  });
  const r = A.apply(S, 0, { t: "take", k: "8,5" });
  const v = A.view(r.state, 0);
  q(
    v.people.filter((p) => p.o !== 0).every((p) => p.n !== null),
    "opponent numbers revealed at game end",
  );
  const other = Object.keys(v.tiles)[0];
  eq(
    Object.keys(v.tiles[other]),
    ["type"],
    "tile contents still hidden after the game",
  );
  q(v.canUndo === false, "no undo at the end");
});

// ---------------------------------------------------------------- invariants under randomness

test("200 random playouts never error and never leak secrets", ({ q }) => {
  for (let g = 1; g <= 200; g++) {
    let S = A.newGame(2 + (g % 3), g),
      n = 0;
    while (!S.over && n++ < 5000) {
      const pl = S.pending ? S.pending.queue[0] : S.cur;
      const r = A.apply(S, pl, pick(S, pl));
      if (r.error) {
        q(false, "game " + g + " phase " + S.phase + " error: " + r.error);
        break;
      }
      S = r.state;
      if (JSON.stringify(A.view(S, 0)).indexOf('"cont"') !== -1) {
        q(false, "game " + g + " leaked tile contents");
        break;
      }
    }
    q(S.over, "game " + g + " finished (phase " + S.phase + ")");
  }
});

// A compact legal-action chooser (self-contained; doesn't rely on tools/bot.js).
function pick(S, pl) {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  if (S.pending) return { t: "defend", play: Math.random() < 0.5 };
  if (S.phase === "setP") return { t: "placePerson", k: r(A.dests(S, pl)) };
  if (S.phase === "setB") return { t: "placeBoat", k: r(A.dests(S, pl)) };
  if (S.phase === "play") {
    for (const t of S.hands[pl]) {
      if (t === "dolph") {
        const p = S.people.find((p) => p.o === pl && p.loc.t === "sea");
        if (p) {
          const d = A.dests(S, pl, { p: p.id }, "dolph");
          if (d.length) return { t: "dolph", p: p.id, to: r(d) };
        }
      }
      if (t === "wind") {
        const b = S.boats.find(
          (b) => A.dests(S, pl, { b: b.id }, "wind").length,
        );
        if (b)
          return {
            t: "wind",
            b: b.id,
            to: r(A.dests(S, pl, { b: b.id }, "wind")),
          };
      }
      if (A.MV[t]) {
        const c = S.creat.find((c) => c.t === A.MV[t]);
        if (c) {
          const d = A.dests(S, pl, { c: c.id }, t);
          if (d.length) return { t: "mcreat", tile: t, c: c.id, to: r(d) };
        }
      }
    }
    return { t: "skipTile" };
  }
  if (S.phase === "move") {
    const o = [];
    S.people
      .filter((p) => p.o === pl)
      .forEach((p) => {
        const d = A.dests(S, pl, { p: p.id });
        if (d.length) o.push({ t: "movePerson", p: p.id, to: r(d) });
      });
    S.boats.forEach((b) => {
      const d = A.dests(S, pl, { b: b.id });
      if (d.length) o.push({ t: "moveBoat", b: b.id, to: r(d) });
    });
    if (!o.length || S.moves <= 0 || Math.random() < 0.2)
      return { t: "endMoves" };
    return r(o);
  }
  if (S.phase === "take") return { t: "take", k: r(A.dests(S, pl)) };
  if (S.phase === "roll") return { t: "roll" };
  if (S.phase === "creature") {
    const o = S.creat
      .filter((c) => c.t === S.roll)
      .map((c) => ({ c, d: A.dests(S, pl, { c: c.id }) }))
      .filter((x) => x.d.length);
    if (o.length && Math.random() < 0.8) {
      const x = r(o);
      return { t: "moveCreature", c: x.c.id, to: r(x.d) };
    }
    return { t: "skipCreature" };
  }
  throw new Error("no action for phase " + S.phase);
}

console.log("\nengine-test: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
