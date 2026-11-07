// Headless check of the browser UI (fake DOM): local mode + rendering a server "view" in online mode
// (my turn / waiting). Runs the built public/index.html bundle.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import A from "../src/engine.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) {
  console.log("ui smoke: FAIL (no <script> in public/index.html)");
  process.exit(1);
}
const src = m[1]!;

const el: Record<string, any> = {};
const mk = (id: string): any =>
  (el[id] = el[id] || {
    style: {},
    _h: "",
    _t: "",
    onclick: null,
    set innerHTML(v: string) {
      this._h = v;
    },
    get innerHTML() {
      return this._h;
    },
    set textContent(v: string) {
      this._t = v;
    },
    get textContent() {
      return this._t;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 600 }),
    setAttribute() {},
    addEventListener() {},
  });
const g = globalThis as any;
g.document = { querySelector: mk, title: "" };
g.location = {
  search: "",
  protocol: "http:",
  host: "x",
  origin: "http://x",
  pathname: "/",
};
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.addEventListener = () => {};
g.WebSocket = class {
  readyState = 1;
  send() {}
  close() {}
};

(0, eval)(src);

const t = g.__ui as any;
const a = (g.Atlantis ?? A) as typeof A;
if (!t || !a) {
  console.log("ui smoke: FAIL (UI/engine handles missing)");
  process.exit(1);
}

// A join that lands on a serverless instance that does not own the room must be retried on a
// fresh connection instead of dropping the player straight back to the menu.
g.onlineMenu();
mk("#jcd").value = "ABC";
mk("#jnm").value = "x";
g.joinRoom();
g.onNet({ type: "error", msg: "اتاقی با این کد یافت نشد: ABC" });
const retried = /تلاش دوباره/.test(el["#ovb"]!._h);
g.menu(); // clears the pending join, so the scheduled retry becomes a no-op
t.setNet(null, 0);

// Regression: the overlay must not reuse an id that already exists in the shell. querySelector
// returns the first match in document order, so a duplicate id (e.g. #cd, the card-description
// div) makes the join read the wrong element and send an empty room code.
// Only the static markup counts — the bundle script contains the overlay templates themselves.
const shellIds = new Set(
  [...html.split("<script>")[0]!.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]!),
);
g.onlineMenu();
const overlayIds = [...el["#ovb"]!._h.matchAll(/\sid="([^"]+)"/g)].map(
  (x) => x[1]!,
);
const dupes = overlayIds.filter((id) => shellIds.has(id));
if (dupes.length)
  throw new Error("overlay reuses shell element id(s): " + dupes.join(", "));
if (!overlayIds.includes("jcd") || !overlayIds.includes("jnm"))
  throw new Error("online menu is missing its name/code inputs");
g.menu();

t.go(2);
while (t.S.phase === "setP")
  t.dispatch({ t: "placePerson", k: a.dests(t.S, t.S.cur)[0] });
while (t.S.phase === "setB")
  t.dispatch({ t: "placeBoat", k: a.dests(t.S, t.S.cur)[0] });
t.dispatch({ t: "skipTile" });
t.dispatch({ t: "endMoves" });
t.dispatch({ t: "take", k: a.dests(t.S, t.S.cur)[0] });
if (t.S.phase !== "roll") throw new Error("local flow broke");

const full = t.S as any;
const sent: any[] = [];
t.setNet({ readyState: 1, send: (m: string) => sent.push(JSON.parse(m)) }, 0);
const msg = (me: number, extra: any = {}): any => ({
  type: "state",
  view: a.view(full, me),
  events: [],
  names: ["علی", "بیتا"],
  connected: [true, true],
  ...extra,
});
t.onNet(msg(0));
const mine = t.st;
t.onNet(msg(1));
const wait = t.st;
t.setNet({ readyState: 1, send: (m: string) => sent.push(JSON.parse(m)) }, 0);
t.onNet(msg(0));
t.dispatch({ t: "roll" });

const ok =
  retried &&
  /تاس/.test(mine) &&
  /نوبت/.test(wait) &&
  sent.length === 1 &&
  sent[0].type === "action" &&
  sent[0].a.t === "roll" &&
  el["#fg"]!._h.length > 10000;
console.log(
  "ui smoke:",
  ok ? "OK" : "FAIL",
  "|",
  mine,
  "|",
  wait,
  "| retry:",
  retried,
);
process.exit(ok ? 0 : 1);
