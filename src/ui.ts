import A from "./engine";
import type { State, ViewState, Sel, Ev, Action, ContentType } from "./engine";
import * as G2 from "./gfx";
import { sfx, toggleMute, isMuted } from "./sfx";

const { SAFE, DOCK, SERP, NB, P, CELLS } = A;
const $ = (s: string): any => document.querySelector(s);
const R3 = Math.sqrt(3),
  SZ = 28;
const C = ["#e63946", "#17a398", "#f2b705", "#8e5bd0"],
  PN = ["قرمز", "سبز", "زرد", "بنفش"];
const T: Record<string, [string, string, string]> = {
  shark: ["🦈", "کوسه", "فوراً روی دریای همین خانه می‌آید؛ شناگرها می‌میرند."],
  whale: ["🐋", "نهنگ", "فوراً روی دریای همین خانه می‌آید."],
  boat: ["⛵", "قایق", "یک قایق می‌آید و تا ۳ شناگر سوار می‌شوند."],
  whirl: [
    "🌀",
    "گرداب",
    "همه‌چیز در این خانه و خانه‌های دریایی مجاور نابود می‌شود.",
  ],
  volc: ["🌋", "آتشفشان!", "بازی تمام شد."],
  dolph: ["🐬", "دلفین", "به دستت می‌رود: یک شناگر را تا ۳ خانه ببر."],
  wind: ["💨", "باد مساعد", "به دستت می‌رود: یک قایق را تا ۳ خانه ببر."],
  mserp: [
    "🐍↔",
    "جابه‌جایی مار",
    "به دستت می‌رود: یک مار را به خانه‌ی خالی ببر.",
  ],
  mshark: [
    "🦈↔",
    "جابه‌جایی کوسه",
    "به دستت می‌رود: یک کوسه را به خانه‌ی خالی ببر.",
  ],
  mwhale: [
    "🐋↔",
    "جابه‌جایی نهنگ",
    "به دستت می‌رود: یک نهنگ را به خانه‌ی خالی ببر.",
  ],
  rshark: [
    "🛡🦈",
    "دفع کوسه",
    "دفاعی: وقتی حریف کوسه را روی شناگر تو می‌آورد.",
  ],
  rwhale: [
    "🛡🐋",
    "دفع نهنگ",
    "دفاعی: وقتی حریف نهنگ را روی قایق تحت کنترل تو می‌آورد.",
  ],
};
const CE: Record<string, string> = { serp: "🐍", shark: "🦈", whale: "🐋" };
const hex = (x: number, y: number, r = SZ): string =>
  [0, 1, 2, 3, 4, 5]
    .map(
      (i) =>
        (x + r * Math.cos((i * Math.PI) / 3)).toFixed(1) +
        "," +
        (y + r * Math.sin((i * Math.PI) / 3)).toFixed(1),
    )
    .join(" ");
const POS: Record<string, { x: number; y: number }> = {};
CELLS.forEach((k: string) => {
  const [c, r] = P(k) as [number, number];
  POS[k] = {
    x: SZ * 1.5 * c + SZ + 8,
    y: SZ * R3 * (r + 0.5 * (c & 1)) + (SZ * R3) / 2 + 8,
  };
});

interface UiState {
  sel: Sel | null;
  mode: string | null;
  pick: number | null;
  peek: boolean;
}
interface Net {
  readyState: number;
  send(d: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
}
interface Overlay {
  h: string;
  cb?: (() => void) | null;
  raw?: boolean;
  id: number;
}

let S: State | null = null;
const ui: UiState = { sel: null, mode: null, pick: null, peek: false };
let LG: string[] = [],
  OQ: Overlay[] = [],
  NET: Net | null = null,
  ME = 0,
  CODE = "",
  NAMES: string[] = [],
  CONN: boolean[] = [],
  PK = "",
  ENDED = 0,
  LOBBY = 0,
  HADSTATE = 0; // whether a game state has arrived on the current connection
const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const actor = (): number =>
  NET ? ME : S!.pending ? S!.pending.queue[0]! : S!.cur;
const V = (): ViewState =>
  NET ? (S as unknown as ViewState) : A.view(S!, actor());
const log = (m: string): void => {
  LG.unshift(m);
  LG.length = Math.min(LG.length, 6);
};

let OVC = 0;
function ov(
  h: string,
  cb?: (() => void) | null,
  raw?: boolean,
  autoMs?: number,
): void {
  const o: Overlay = { h, cb, raw, id: ++OVC };
  OQ.push(o);
  if (autoMs) setTimeout(() => closeOverlay(o), autoMs);
  ovShow();
}
// Show the newest overlay. A newer entry replaces whatever is on screen, so a tile reveal or a lobby
// update is never hidden behind a stale modal (this was why online reveals silently didn't appear).
function ovShow(): void {
  const o = OQ[OQ.length - 1];
  if (!o) {
    $("#ov").style.display = "none";
    return;
  }
  $("#ovb").innerHTML =
    o.h + (o.raw ? "" : '<p><button id="ok">باشه</button></p>');
  $("#ov").style.display = "flex";
  if (!o.raw) $("#ok").onclick = () => closeOverlay(o);
}
function closeOverlay(o: Overlay): void {
  const i = OQ.indexOf(o);
  if (i >= 0) OQ.splice(i, 1);
  ovShow();
}

function dispatch(a: Action): void {
  if (NET) {
    if (NET.readyState !== 1) {
      log("⚠ اتصال برقرار نیست");
      return render();
    }
    NET.send(JSON.stringify({ type: "action", a }));
    ui.sel = null;
    if (a.t === "placePerson") {
      ui.pick = null;
      ui.peek = false;
    }
    return;
  }
  const r = A.apply(S!, actor(), a);
  if ("error" in r) {
    log("⚠ " + r.error);
    return render();
  }
  S = r.state;
  ui.sel = null;
  if (S.phase !== "play") ui.mode = null;
  if (a.t === "placePerson") {
    ui.pick = null;
    ui.peek = false;
  }
  r.events.forEach(onEv);
  render();
  if (S.pending) prompt();
}

function onEv(e: Ev): void {
  switch (e.type) {
    case "reveal": {
      const i = T[e.cont]!;
      // Auto-dismiss so the tile is shown clearly but never blocks the next step.
      ov(
        `<div class="big">${i[0]}</div><h3>${i[1]}</h3><p>${i[2]}</p>`,
        null,
        false,
        12000,
      );
      break;
    }
    case "took":
      fxTook(e);
      log(PN[e.pl] + " کاشی برداشت: " + (e.cont ? T[e.cont]![1] : "(مخفی)"));
      break;
    case "saved":
      sfx("saved");
      log(PN[e.pl] + " یک نفر را نجات داد.");
      break;
    case "roll":
      showDie(e.face);
      sfx("roll");
      log(PN[e.pl] + " تاس ریخت: " + CE[e.face]);
      break;
    case "cmove":
      sfx("splash");
      log(PN[e.pl] + " " + CE[e.t] + " را حرکت داد.");
      break;
    case "defended":
      sfx("shield");
      log(PN[e.pl] + " «" + T[e.tile]![1] + "» را بازی کرد.");
      break;
    case "capsize":
      fxHit(e.k);
      sfx("crash");
      log("نهنگ قایقی را واژگون کرد.");
      break;
    case "devoured":
      fxHit(e.k);
      sfx("crash");
      log("مار دریایی یک قایق را بلعید.");
      break;
    case "turn":
      if (NET) {
        log("نوبت " + PN[e.cur] + " است.");
        if (e.cur === ME) {
          document.title = "🔔 نوبت توست";
          sfx("turn");
        }
        break;
      }
      ov(
        `<div class="big">${PN[e.cur]}</div><p>نوبت بازیکن <b style="color:${C[e.cur]}">${PN[e.cur]}</b> است.<br>صفحه را به او بدهید.</p>`,
      );
      break;
    case "end": {
      ENDED = 1;
      const R = S!.result!;
      const b = Math.max(...R.map((r) => r.total));
      ov(
        '<div class="big">🌋</div><h3>پایان بازی</h3>' +
          R.map(
            (r) =>
              `<p style="color:${C[r.o]}"><b>${PN[r.o]}</b>: ${r.nums.length} نفر [${r.nums.join("+") || "—"}] = <b>${r.total}</b>${r.total === b ? " 🏆" : ""}</p>`,
          ).join("") +
          '<p><button onclick="location.reload()">بازی جدید</button></p>',
        null,
        true,
      );
    }
  }
}

function prompt(): void {
  const d = S!.pending!;
  const t = d.tile;
  const o = d.queue[0]!;
  if (NET && o !== ME) return;
  ov(
    `<div class="big">${T[t]![0]}</div><h3>بازیکن <span style="color:${C[o]}">${PN[o]}</span></h3><p>${t === "rshark" ? "کوسه به شناگر تو رسیده." : "نهنگ به قایقی که کنترل می‌کنی رسیده."}${NET ? "" : "<br>صفحه را به او بدهید."}</p><p><button onclick="defend(1)">بازی کردن «${T[t]![1]}»</button> <button class="g" onclick="defend(0)">پاس</button></p>`,
    null,
    true,
  );
}
function defend(p: number): void {
  OQ.pop();
  dispatch({ t: "defend", play: !!p });
  ovShow();
}

const U = {
  tile(t: string): void {
    ui.mode = t;
    ui.sel = null;
    render();
  },
  skip: (): void => dispatch({ t: "skipTile" }),
  done: (): void => dispatch({ t: "endMoves" }),
  roll: (): void => dispatch({ t: "roll" }),
  skipC: (): void => dispatch({ t: "skipCreature" }),
  undo: (): void => dispatch({ t: "undo" }),
  peek(): void {
    ui.peek = !ui.peek;
    render();
  },
  pick(i: number): void {
    ui.pick = i;
    render();
  },
};

$("#bd").onclick = (e: MouseEvent): void => {
  if (SUP) {
    SUP = 0;
    return;
  }
  if (!S || S.phase === "end") return;
  const el = (e.target as HTMLElement).closest(
    "[data-k]",
  ) as HTMLElement | null;
  if (!el) return;
  const k = el.dataset.k!;
  const d = (e.target as HTMLElement).closest(
    "[data-p],[data-b],[data-c]",
  ) as HTMLElement | null;
  if (A.dests(S, actor(), ui.sel || {}, ui.mode || undefined).includes(k))
    return act(k);
  if (!d) ui.sel = null;
  else {
    const id = +(d.dataset.p ?? d.dataset.b ?? d.dataset.c)!;
    ui.sel =
      d.dataset.p !== undefined
        ? { p: id }
        : d.dataset.b !== undefined
          ? { b: id }
          : { c: id };
  }
  render();
};

function act(k: string): void {
  const s = ui.sel || {},
    m = ui.mode,
    ph = S!.phase;
  dispatch(
    ph === "setP"
      ? { t: "placePerson", k, id: ui.pick ?? undefined }
      : ph === "setB"
        ? { t: "placeBoat", k }
        : ph === "take"
          ? { t: "take", k }
          : ph === "creature"
            ? { t: "moveCreature", c: s.c!, to: k }
            : ph === "play"
              ? m === "dolph"
                ? { t: "dolph", p: s.p!, to: k }
                : m === "wind"
                  ? { t: "wind", b: s.b!, to: k }
                  : { t: "mcreat", tile: m as ContentType, c: s.c!, to: k }
              : s.p !== undefined
                ? { t: "movePerson", p: s.p, to: k }
                : { t: "moveBoat", b: s.b!, to: k },
  );
}

const WAVE = (id: string, op: number, dx: number, dur: number): string =>
  `<pattern id="${id}" width="30" height="16" patternUnits="userSpaceOnUse"><path d="M0 8q7.5-7 15 0t15 0" fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="1.5"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to="${dx} 0" dur="${dur}s" repeatCount="indefinite"/></pattern>`;
const DEFS = `<defs><radialGradient id="sea" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#3b97d1"/><stop offset="1" stop-color="#0d466f"/></radialGradient><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e8ae"/><stop offset="1" stop-color="#d8b565"/></linearGradient><linearGradient id="gf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#78c46f"/><stop offset="1" stop-color="#34803f"/></linearGradient><linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3c6d0"/><stop offset="1" stop-color="#6b6e80"/></linearGradient><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a6e585"/><stop offset="1" stop-color="#4aa653"/></linearGradient>${WAVE("wv", 0.14, 30, 9)}${WAVE("wv2", 0.08, -30, 14)}<filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter></defs><rect x="-300" y="-300" width="1350" height="1180" fill="url(#sea)"/><rect x="-300" y="-300" width="1350" height="1180" fill="url(#wv)"/><rect x="-300" y="-300" width="1350" height="1180" fill="url(#wv2)" transform="translate(0 8)"/>${[[90, 70], [610, 120], [300, 520], [690, 470], [120, 330], [470, 40], [40, 520]].map(([x, y], n) => `<circle class="twk" cx="${x}" cy="${y}" r="1.6" fill="#fff" style="animation-delay:${n * 0.7}s"/>`).join("")}`;
let LAYERS = false;
function layers(): void {
  if (LAYERS) return;
  LAYERS = true;
  $("#bd").innerHTML = DEFS + '<g id="fg"></g><g id="fx" pointer-events="none"></g>';
}
const tr = (x: number, y: number, z: number): string =>
  `<path d="M${x - 6 * z} ${y}l${6 * z}-${12 * z} ${6 * z} ${12 * z}zM${x - 5 * z} ${y - 5 * z}l${5 * z}-${11 * z} ${5 * z} ${11 * z}z" fill="#1f6b34"/><path d="M${x - 0.8} ${y}h1.6v3h-1.6z" fill="#5a3a1a"/>`;
const deco = (t: string, h: number): string => {
  const d = (h - 1) * 5;
  return t === "b"
    ? `<ellipse cx="-12" cy="9" rx="7" ry="1.8" fill="#b8924a" opacity=".5"/><ellipse cx="11" cy="12" rx="6" ry="1.6" fill="#b8924a" opacity=".5"/><g transform="translate(${d},0)"><path d="M-1 10Q1 2 4-5" stroke="#8a5a2b" stroke-width="2.4" fill="none"/><path d="M4-5q-9-3-13 3M4-5q9-3 13 3M4-5q-3-9-11-7M4-5q4-9 12-6" stroke="#2f9e44" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`
    : t === "f"
      ? tr(-10 + d, 8, 0.9) + tr(2 - d, 6, 1.1) + tr(13, 9, 0.8)
      : `<g transform="translate(${d},0)"><path d="M-17 11L-4-9 9 11z" fill="#555869"/><path d="M-4-9l-5 8 3 1 2-2 2 2 3-1z" fill="#fff"/><path d="M3 11L12-3 21 11z" fill="#777a8d"/></g>`;
};
const OFF = [
  [0, 3],
  [-13, -6],
  [13, -6],
  [-13, 12],
  [13, 12],
  [0, -8],
  [0, 18],
];

interface Tk { x: number; y: number; k: string; kind: string; col: string }
const artOf = (kind: string, col: string): string =>
  kind === "person" ? G2.person(col) : kind === "rider" ? `<g transform="scale(.86)">${G2.person(col, true)}</g>` : kind === "boat" ? G2.boat() : G2.creature(kind);
let PREV: Map<string, Tk> | null = null,
  PTILES: Record<string, string> | null = null;
function resetGfx(): void {
  PREV = null;
  PTILES = null;
  const fx = $("#fx");
  if (fx) fx.innerHTML = "";
}
// Add transient effects to the persistent #fx layer; they remove themselves.
function fxAdd(html: string, ms = 1800): void {
  const fx = $("#fx");
  if (!fx || typeof fx.insertAdjacentHTML !== "function") return;
  const before = fx.childElementCount;
  fx.insertAdjacentHTML("beforeend", html);
  const added = Array.from(fx.children).slice(before) as Element[];
  setTimeout(() => added.forEach((e) => e.remove()), ms);
}
// Compare this frame with the previous one: slide moved tokens, pop in new ones, sink the dead,
// sparkle the rescued, and lift taken tiles off the board.
function diff(cur: Map<string, Tk>, tiles: Record<string, string>, fate: Map<string, string>): void {
  const prev = PREV, pt = PTILES;
  PREV = cur;
  PTILES = tiles;
  if (!prev || !pt) return;
  const fg = $("#fg");
  let fx = "", moved = false;
  const els: ArrayLike<Element> = typeof fg.querySelectorAll === "function" ? fg.querySelectorAll(".tk") : [];
  Array.from(els).forEach((el) => {
    const tid = el.getAttribute("data-tid")!, n = cur.get(tid)!, o = prev.get(tid), cr = n.kind === "serp" || n.kind === "shark" || n.kind === "whale";
    const st = (el as SVGGElement).style;
    if (!o) {
      el.firstElementChild?.classList.add("pop");
      if (cr) fx += G2.ripple(n.x, n.y);
    } else if (o.x !== n.x || o.y !== n.y) {
      moved = true;
      st.transition = "none";
      st.transform = `translate(${o.x}px,${o.y}px)`;
      el.getBoundingClientRect();
      st.transition = "transform .45s cubic-bezier(.3,.7,.3,1)";
      st.transform = `translate(${n.x}px,${n.y}px)`;
      if (cr) fx += G2.ripple(n.x, n.y);
    }
  });
  prev.forEach((o, tid) => {
    if (cur.has(tid)) return;
    if (fate.get(tid) === "safe") {
      fx += G2.sparkle(o.x, o.y);
      return;
    }
    fx += `<g style="transform:translate(${o.x}px,${o.y}px)"><g class="gh">${artOf(o.kind, o.col)}</g></g>` + G2.bubbles(o.x, o.y);
  });
  for (const k in pt) {
    if (k in tiles) continue;
    const { x, y } = POS[k]!, gr = { b: "gb", f: "gf", m: "gm" }[pt[k] as "b" | "f" | "m"];
    fx += `<g style="transform:translate(${x}px,${y}px)"><g class="tileout"><polygon points="${hex(0, 4)}" fill="#3a3a3a"/><polygon points="${hex(0, 0)}" fill="url(#${gr})" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round"/><g transform="translate(0,-13) scale(.8)">${deco(pt[k]!, 1)}</g></g></g>`;
  }
  if (fx) fxAdd(fx);
  if (moved) sfx("move");
}
function showDie(face: string): void {
  const d = $("#die");
  if (!d) return;
  d.innerHTML = `<div class="dice"><span id="df">${G2.dieFace(face)}</span></div>`;
  const faces = ["serp", "shark", "whale"];
  let i = 0;
  const t = setInterval(() => {
    const f = $("#df");
    if (f) f.innerHTML = G2.dieFace(faces[i++ % 3]!);
  }, 90);
  setTimeout(() => {
    clearInterval(t);
    const f = $("#df");
    if (f) f.innerHTML = G2.dieFace(face);
  }, 750);
  setTimeout(() => {
    d.innerHTML = "";
  }, 2100);
}
function fxTook(e: { k: string; cont: ContentType | null }): void {
  sfx("take");
  const p = POS[e.k];
  if (!p) return;
  if (e.cont === "whirl") {
    fxAdd(G2.whirl(p.x, p.y), 2000);
    sfx("whirl");
  } else if (e.cont === "volc") {
    fxAdd(G2.embers(p.x, p.y), 2600);
    const d = $("#die");
    if (d) d.innerHTML = '<div class="flash"></div>';
    setTimeout(() => {
      if (d) d.innerHTML = "";
    }, 1500);
    sfx("erupt");
  }
}
function fxHit(k: string): void {
  const p = POS[k];
  if (p) fxAdd(G2.ripple(p.x, p.y) + G2.bubbles(p.x, p.y));
}

function render(): void {
  if (!S) return;
  const v = V(),
    me = actor(),
    DS = A.dests(S, me, ui.sel || {}, ui.mode || undefined),
    sel: Sel = ui.sel || {};
  let s = "",
    sd = "",
    th = "",
    fo = "";
  for (const k of CELLS) {
    const { x, y } = POS[k]!;
    const t = (v.tiles as Record<string, { type: string }>)[k];
    if (t || SAFE.includes(k)) {
      const c = t
        ? { b: "#a8863f", f: "#1f5a2c", m: "#444655" }[
            t.type as "b" | "f" | "m"
          ]
        : "#2f7a3a";
      fo += `<polygon points="${hex(x, y, SZ * 1.16)}" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>`;
      sd += `<polygon points="${hex(x + 3, y + 9)}" fill="#001a33" fill-opacity=".28" pointer-events="none"/>`;
      th += `<polygon points="${hex(x, y + 4)}" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round" pointer-events="none"/>`;
    }
  }
  s += (fo ? `<g filter="url(#blur)" opacity=".5" pointer-events="none">${fo}</g>` : "") + sd + th;
  for (const k of CELLS) {
    const { x, y } = POS[k]!;
    const t = (v.tiles as Record<string, { type: string }>)[k];
    const sf = SAFE.includes(k),
      h = (P(k) as number[]).reduce((a, b) => a * 7 + b, 3) % 3;
    if (t) {
      const d = { b: "gb", f: "gf", m: "gm" }[t.type as "b" | "f" | "m"];
      s += `<polygon data-k="${k}" points="${hex(x, y)}" fill="url(#${d})" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round"/><polygon points="${hex(x, y, SZ * 0.84)}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.2" pointer-events="none"/><g pointer-events="none" transform="translate(${x},${y - 13}) scale(.8)">${deco(t.type, h)}</g>`;
    } else if (sf) {
      s += `<polygon data-k="${k}" points="${hex(x, y)}" fill="url(#gs)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><g transform="translate(${x},${y + 1}) scale(.9)">${G2.island()}</g>`;
    } else {
      const sh = NB(k).some((n) => v.tiles[n]);
      s += `<polygon data-k="${k}" points="${hex(x, y)}" fill="${sh ? "#8fdcf5" : "#fff"}" fill-opacity="${sh ? 0.2 : 0}" stroke="#fff" stroke-opacity=".1"/>`;
      if (SERP.includes(k))
        s += `<circle cx="${x}" cy="${y}" r="21" fill="none" stroke="#c77dff" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7" pointer-events="none"/>`;
      if (DOCK[k])
        s += `<polygon points="${hex(x, y)}" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/><g transform="translate(${x},${y - 14}) scale(.6)" opacity=".85" pointer-events="none">${G2.anchor()}</g>`;
    }
  }
  for (const k of DS) {
    const { x, y } = POS[k]!;
    s += `<polygon class="hl" points="${hex(x, y)}" fill="#ffe066" fill-opacity=".38" stroke="#ffe066" stroke-width="3" pointer-events="none"/>`;
  }
  interface TokDef { tid: string; kind: string; col: string; data: string; sl: boolean }
  const L: Record<string, TokDef[]> = {};
  const add = (k: string, o: TokDef): void => {
    (L[k] = L[k] || []).push(o);
  };
  v.boats.forEach((b) => add(b.k, { tid: "b" + b.id, kind: "boat", col: "", data: `data-b="${b.id}"`, sl: sel.b === b.id }));
  v.creat.forEach((c) => add(c.k, { tid: "c" + c.id, kind: c.t, col: "", data: `data-c="${c.id}"`, sl: sel.c === c.id }));
  const fate = new Map<string, string>();
  v.people.forEach((p) => {
    fate.set("p" + p.id, p.loc.t);
    if (["dead", "safe", "hand"].includes(p.loc.t)) return;
    add(A.pk(v, p), { tid: "p" + p.id, kind: p.loc.t === "boat" ? "rider" : "person", col: C[p.o]!, data: `data-p="${p.id}"`, sl: sel.p === p.id });
  });
  const cur = new Map<string, Tk>();
  for (const k in L) {
    const { x, y } = POS[k]!;
    L[k]!.forEach((o, i) => {
      const px = x + OFF[i % 7]![0]!, py = y + OFF[i % 7]![1]!;
      cur.set(o.tid, { x: px, y: py, k, kind: o.kind, col: o.col });
      const hit = o.kind === "person" || o.kind === "rider" ? 13 : 15;
      s += `<g class="tk" data-tid="${o.tid}" style="transform:translate(${px}px,${py}px)">${o.sl ? '<circle r="16" fill="#fff8" stroke="#ffe066" stroke-width="3" class="selr" pointer-events="none"/>' : ""}<g class="in" pointer-events="none">${artOf(o.kind, o.col)}</g><circle data-k="${k}" ${o.data} r="${hit}" fill="transparent" style="cursor:pointer"/></g>`;
    });
  }
  const tilesNow: Record<string, string> = {};
  for (const [k, t] of Object.entries(v.tiles as Record<string, { type: string }>)) tilesNow[k] = t.type;
  layers();
  $("#fg").innerHTML = s;
  diff(cur, tilesNow, fate);

  const ph = v.phase,
    h = v.hands[me] || [],
    UB = v.canUndo
      ? '<button class="g" onclick="U.undo()">↩ برگردان</button> '
      : "";
  let st = "",
    bt = "";
  if (ph === "setP") {
    const mine = v.people.filter((p) => p.o === me && p.loc.t === "hand");
    const pk0 = ui.pick ?? (mine[0] || {}).id;
    st = `چیدن مهره — نوبت ${PN[me]} (${mine.length} مانده): یک مهره انتخاب کن و کاشی روشن بزن.`;
    bt =
      `<button class="g" onclick="U.peek()">${ui.peek ? "پنهان کردن" : "نمایش اعداد"}</button> ` +
      mine
        .map(
          (p) =>
            `<button class="${pk0 === p.id ? "" : "g"}" onclick="U.pick(${p.id})">${ui.peek ? p.n : "?"}</button>`,
        )
        .join(" ");
  }
  if (ph === "setB")
    st = `چیدن قایق — نوبت ${PN[me]} (${v.boatsLeft[me]} مانده): یک خانه‌ی دریایی کنار جزیره بزن.`;
  if (ph === "play") {
    st = `مرحله ۱ — ${PN[me]}: کاشی دستی بازی کن یا ادامه بده.`;
    h.filter(
      (t): t is ContentType => !!t && !["rshark", "rwhale"].includes(t),
    ).forEach((t) => {
      bt += `<button class="${ui.mode === t ? "" : "g"}" onclick="U.tile('${t}')">${T[t]![0]} ${T[t]![1]}</button> `;
    });
    if (ui.mode) st += " (مهره/موجود را انتخاب و خانه‌ی روشن را بزن)";
    bt += UB + '<button onclick="U.skip()">ادامه</button>';
  }
  if (ph === "move") {
    st = `مرحله ۲ — ${PN[me]}: ${v.moves} حرکت مانده. مهره یا قایقت را انتخاب کن.`;
    bt = UB + '<button onclick="U.done()">پایان حرکت‌ها</button>';
  }
  if (ph === "take") st = "مرحله ۳ — یکی از کاشی‌های روشن را بردار.";
  if (ph === "roll") {
    st = "مرحله ۴ — تاس موجودات را بریز.";
    bt = '<button onclick="U.roll()">🎲 ریختن تاس</button>';
  }
  if (ph === "creature") {
    const has = v.creat.some((c) => c.t === v.roll);
    st = `مرحله ۴ — تاس: ${CE[v.roll!]} ${has ? "— موجود را انتخاب و حرکت بده." : "(روی تخته نیست)"}`;
    bt = `<button class="${has ? "g" : ""}" onclick="U.skipC()">${has ? "رد کردن" : "پایان نوبت"}</button>`;
  }
  if (ph === "end") st = "بازی تمام شد.";
  if (NET && ph !== "end") {
    const q = v.pending;
    if (q && q.queue[0] !== ME) {
      st = "منتظر تصمیم " + PN[q.queue[0]!] + "…";
      bt = "";
    } else if (!q && v.cur !== ME) {
      st =
        "نوبت " +
        PN[v.cur] +
        (NAMES[v.cur] ? " (" + NAMES[v.cur] + ")" : "") +
        " است…";
      bt = "";
    }
  }
  $("#st").textContent = st;
  $("#bt").innerHTML = bt;
  $("#sc").innerHTML = [...Array(v.n).keys()]
    .map((o) => {
      const ps = v.people.filter((p) => p.o === o),
        f = (x: (p: any) => boolean): number => ps.filter(x).length;
      return `<span class="chip${o === v.cur ? " cur" : ""}"><i class="dot" style="background:${C[o]}"></i>${NAMES[o] ? esc(NAMES[o]) : PN[o]}${NET && o === ME ? " (تو)" : ""}${NET && CONN[o] === false ? " ⚠" : ""} ✅${f((p) => p.loc.t === "safe")} 🧍${f((p) => !["safe", "dead", "hand"].includes(p.loc.t))} 💀${f((p) => p.loc.t === "dead")} 🎴${v.hands[o]!.length}</span>`;
    })
    .join("");
  $("#lg").innerHTML =
    (NET ? "کد اتاق: <b>" + esc(CODE) + "</b><br>" : "") + LG.join("<br>");
  $("#lgs").textContent = (NET ? "[" + CODE + "] " : "") + (LG[0] || "گزارش");
}

function go(n: number): void {
  resetGfx();
  NET = null;
  OQ = [];
  $("#ov").style.display = "none";
  S = A.newGame(n);
  LG = ["چیدن: هر بازیکن به نوبت یک مهره روی یک کاشی خالی می‌گذارد."];
  render();
  ov(
    "<h3>چیدن مهره‌ها</h3><p>هر بازیکن به نوبت یک مهره روی یک کاشی خالی می‌گذارد، بعد قایق‌ها. «نمایش اعداد» را فقط در نوبت خودت بزن و عدد را به خاطر بسپار.</p>",
  );
}

const SES = "atlantis-session";
const ST = (): { code: string; token: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(SES)!) as {
      code: string;
      token: string;
    };
  } catch {
    return null;
  }
};
const setST = (o: { code: string; token: string } | null): void => {
  try {
    if (o) localStorage.setItem(SES, JSON.stringify(o));
    else localStorage.removeItem(SES);
  } catch {
    /* ignore */
  }
};

function menu(): void {
  OQ = [];
  const s = ST();
  ov(
    `<h3>فرار از آتلانتیس</h3><p><button onclick="localMenu()">بازی محلی (یک صفحه)</button></p><p><button onclick="onlineMenu()">بازی آنلاین</button></p>${s ? `<p><button class="g" onclick="resume()">ادامه‌ی بازی قبلی (${esc(s.code)})</button></p>` : ""}`,
    null,
    true,
  );
}
function localMenu(): void {
  OQ = [];
  ov(
    '<h3>چند بازیکن؟</h3><p><button class="g" onclick="go(2)">۲</button> <button class="g" onclick="go(3)">۳</button> <button class="g" onclick="go(4)">۴</button></p><p><button class="g" onclick="menu()">بازگشت</button></p>',
    null,
    true,
  );
}
function onlineMenu(msg?: string): void {
  OQ = [];
  const q = new URLSearchParams(location.search).get("room") || "";
  ov(
    `<h3>بازی آنلاین</h3><p><input id="nm" placeholder="نام تو" maxlength="16"></p><p>ساخت اتاق: <button onclick="mkRoom(2)">۲</button> <button onclick="mkRoom(3)">۳</button> <button onclick="mkRoom(4)">۴</button> نفره</p><p><input id="cd" placeholder="کد اتاق" maxlength="5" value="${esc(q)}" style="text-transform:uppercase"> <button onclick="joinRoom()">ورود</button></p><p style="color:#e63946">${msg ? esc(msg) : ""}</p><p><button class="g" onclick="menu()">بازگشت</button></p>`,
    null,
    true,
  );
}
const val = (id: string): string => ($(id) || {}).value || "";
function mkRoom(n: number): void {
  connect({ type: "create", n, name: val("#nm") });
}
function joinRoom(): void {
  connect({
    type: "join",
    code: val("#cd").toUpperCase().trim(),
    name: val("#nm"),
  });
}
function resume(): void {
  const s = ST();
  if (s) connect({ type: "rejoin", code: s.code, token: s.token });
}

function connect(first: Record<string, unknown>): void {
  HADSTATE = 0;
  resetGfx();
  if (NET) {
    try {
      NET.onclose = null;
      NET.close();
    } catch {
      /* ignore */
    }
  }
  let ws: Net;
  try {
    ws = new WebSocket(
      (location.protocol === "https:" ? "wss://" : "ws://") + location.host,
    ) as unknown as Net;
  } catch {
    NET = null;
    return onlineMenu("اتصال به سرور ممکن نیست.");
  }
  NET = ws;
  ws.onopen = (): void => ws.send(JSON.stringify(first));
  ws.onmessage = (e: { data: string }): void => {
    let m: any;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    onNet(m);
  };
  ws.onclose = (): void => {
    if (NET !== ws) return;
    if (!S && !LOBBY) {
      NET = null;
      return onlineMenu("اتصال به سرور ممکن نیست.");
    }
    log("⚠ اتصال قطع شد؛ تلاش دوباره…");
    render();
    setTimeout(() => {
      const s = ST();
      if (NET === ws && s)
        connect({ type: "rejoin", code: s.code, token: s.token });
    }, 2000);
  };
}

function onNet(m: any): void {
  if (m.type === "error") {
    if (!S && !LOBBY) {
      if (/یافت نشد/.test(m.msg)) setST(null);
      NET = null;
      return onlineMenu(m.msg);
    }
    log("⚠ " + m.msg);
    return render();
  }
  if (m.type === "joined") {
    CODE = m.code;
    ME = m.seat;
    setST({ code: m.code, token: m.token });
    return;
  }
  if (m.type === "lobby") {
    NAMES = m.names;
    LOBBY = 1;
    OQ = [];
    ov(
      `<h3>اتاق <b>${esc(m.code)}</b></h3><p>${m.names.length} از ${m.n} نفر وصل شده‌اند:</p><p>${m.names.map((x: string, i: number) => `<span style="color:${C[i]}">● ${esc(x)}</span>`).join("<br>")}</p><p>کد را برای دوستانت بفرست، یا این لینک:<br><small dir="ltr">${esc(location.origin + location.pathname + "?room=" + m.code)}</small></p>`,
      null,
      true,
    );
    return;
  }
  if (m.type === "state") {
    // The first state of a game (or a fresh connection) closes any lobby / menu overlay.
    // The joining player never receives a lobby message (the server sets state before it
    // broadcasts), so clearing on the first state is what lets player 2 actually play.
    if (LOBBY || !HADSTATE) {
      LOBBY = 0;
      HADSTATE = 1;
      OQ = [];
      ovShow();
    }
    NAMES = m.names;
    CONN = m.connected;
    const view = m.view as ViewState;
    S = view as unknown as State;
    ME = view.me;
    if (S!.phase !== "play") ui.mode = null;
    ui.sel = null;
    (m.events as Ev[]).forEach(onEv);
    if (S!.over && !ENDED) onEv({ type: "end" });
    render();
    const k = S!.pending ? JSON.stringify(S!.pending) : "";
    if (k && S!.pending!.queue[0] === ME && k !== PK) {
      PK = k;
      prompt();
    }
    if (!k) PK = "";
  }
}

// ---- board pan / pinch-zoom (touch + mouse wheel). viewBox is kept at the container's aspect ratio. ----
const BW = 750,
  BH = 580;
const bwr = (): DOMRect => $("#bw").getBoundingClientRect();
let VB = { x: 0, y: 0, w: BW, h: BH },
  SUP = 0,
  mv = 0;
const PT = new Map<number, [number, number]>();
function setVB(): void {
  const r = bwr();
  VB.w = Math.min(Math.max(VB.w, 150), 900);
  VB.h = (VB.w * r.height) / Math.max(r.width, 1);
  VB.x = Math.min(Math.max(VB.x, -VB.w * 0.3), BW - VB.w * 0.7);
  VB.y = Math.min(Math.max(VB.y, -VB.h * 0.3), BH - VB.h * 0.7);
  $("#bd").setAttribute("viewBox", VB.x + " " + VB.y + " " + VB.w + " " + VB.h);
}
function fitView(): void {
  const r = bwr(),
    asp = r.width / Math.max(r.height, 1),
    w = asp < 0.85 ? 460 : Math.max(BW + 16, (BH + 16) * asp);
  VB = { x: 375 - w / 2, y: 290 - w / asp / 2, w, h: BH };
  setVB();
}
function zoomAt(f: number, cx: number, cy: number, nx = cx, ny = cy): void {
  const r = bwr(),
    wx = VB.x + ((cx - r.left) * VB.w) / r.width,
    wy = VB.y + ((cy - r.top) * VB.h) / r.height;
  VB.w *= f;
  setVB();
  VB.x = wx - ((nx - r.left) * VB.w) / r.width;
  VB.y = wy - ((ny - r.top) * VB.h) / r.height;
  setVB();
}
$("#bd").addEventListener("pointerdown", (e: PointerEvent) => {
  PT.set(e.pointerId, [e.clientX, e.clientY]);
  mv = 0;
});
addEventListener("pointermove", (e: PointerEvent) => {
  const o = PT.get(e.pointerId);
  if (!o) return;
  const n: [number, number] = [e.clientX, e.clientY];
  if (PT.size === 1) {
    const r = bwr(),
      dx = n[0] - o[0],
      dy = n[1] - o[1];
    mv += Math.abs(dx) + Math.abs(dy);
    if (mv > 8) {
      VB.x -= (dx * VB.w) / r.width;
      VB.y -= (dy * VB.h) / r.height;
      setVB();
    }
  } else if (PT.size === 2) {
    const q = [...PT.entries()].find((p) => p[0] !== e.pointerId)![1];
    const d0 = Math.hypot(o[0] - q[0], o[1] - q[1]),
      d1 = Math.hypot(n[0] - q[0], n[1] - q[1]);
    mv = 99;
    if (d0 > 0 && d1 > 0)
      zoomAt(
        d0 / d1,
        (o[0] + q[0]) / 2,
        (o[1] + q[1]) / 2,
        (n[0] + q[0]) / 2,
        (n[1] + q[1]) / 2,
      );
  }
  PT.set(e.pointerId, n);
});
const pup = (e: PointerEvent): void => {
  if (PT.delete(e.pointerId) && mv > 8) {
    SUP = 1;
    setTimeout(() => {
      SUP = 0;
    }, 60);
  }
};
addEventListener("pointerup", pup as EventListener);
addEventListener("pointercancel", pup as EventListener);
$("#bw").addEventListener(
  "wheel",
  (e: WheelEvent) => {
    e.preventDefault();
    zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
  },
  { passive: false },
);
const zc = (f: number) => (): void => {
  const r = bwr();
  zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
};
$("#zi").onclick = zc(0.75);
$("#zo").onclick = zc(1.33);
$("#zf").onclick = fitView;
$("#zm").textContent = isMuted() ? "🔇" : "🔊";
$("#zm").onclick = (): void => {
  $("#zm").textContent = toggleMute() ? "🔇" : "🔊";
};
addEventListener("resize", fitView);
fitView();

// Expose the handlers referenced by inline onclick attributes, plus a hook for the UI smoke test.
const G = globalThis as unknown as Record<string, unknown>;
Object.assign(G, {
  U,
  go,
  menu,
  localMenu,
  onlineMenu,
  mkRoom,
  joinRoom,
  resume,
  defend,
  connect,
  onNet,
  render,
  dispatch,
});
G.__ui = {
  go,
  dispatch,
  onNet,
  render,
  get S(): State | null {
    return S;
  },
  setNet(n: Net | null, me: number): void {
    NET = n;
    ME = me;
  },
  get st(): string {
    return $("#st").textContent;
  },
};

if (
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("room")
)
  onlineMenu();
else menu();
