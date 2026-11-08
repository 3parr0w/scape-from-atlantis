// Board view: geometry-driven SVG for the static sea/tiles, the per-render token layer, the
// token-diff animation, and the pan/zoom viewport (pointer, wheel, buttons and keyboard).
import A from "../engine";
import type { ViewState, Sel } from "../engine";
import * as G2 from "../gfx";
import { sfx } from "../sfx";
import { store, actor, H } from "./state";
import {
  $,
  C,
  CELLS,
  DOCK,
  NB,
  OFF,
  P,
  POS,
  SAFE,
  SERP,
  artOf,
  hex,
} from "./dom";
import type { Tk } from "./dom";
import { fxAdd } from "./fx";

// ---- static board art ---------------------------------------------------------------------

export const DEFS = `<defs><radialGradient id="sea" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#3b97d1"/><stop offset="1" stop-color="#0d466f"/></radialGradient><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e8ae"/><stop offset="1" stop-color="#d8b565"/></linearGradient><linearGradient id="gf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#78c46f"/><stop offset="1" stop-color="#34803f"/></linearGradient><linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3c6d0"/><stop offset="1" stop-color="#6b6e80"/></linearGradient><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a6e585"/><stop offset="1" stop-color="#4aa653"/></linearGradient></defs><rect x="-300" y="-300" width="1350" height="1180" fill="url(#sea)"/>`;

let LAYERS = false;
// Three layers: #fg is the static board (sea + tiles, rebuilt only when a tile is removed),
// #tk holds highlights and tokens (rebuilt every render), #fx holds transient effects.
export function layers(): void {
  if (LAYERS) return;
  LAYERS = true;
  $("#bd").innerHTML =
    DEFS + '<g id="fg"></g><g id="tk"></g><g id="fx" pointer-events="none"></g>';
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

// ---- per-render state ----------------------------------------------------------------------

let PREV: Map<string, Tk> | null = null;
let PTILES: Record<string, string> | null = null;
let BKEY = "";
let NEEDFIT = false;

export function resetGfx(): void {
  NEEDFIT = true; // fit the board once the game screen (panels, hand cards) has its real size
  PREV = null;
  PTILES = null;
  BKEY = "";
  const fx = $("#fx");
  if (fx) fx.innerHTML = "";
}

// Compare this frame with the previous one: slide moved tokens, pop in new ones, sink the dead,
// sparkle the rescued, and lift taken tiles off the board.
function diff(
  cur: Map<string, Tk>,
  tiles: Record<string, string>,
  fate: Map<string, string>,
): void {
  const prev = PREV,
    pt = PTILES;
  PREV = cur;
  PTILES = tiles;
  if (!prev || !pt) return;
  const fg = $("#tk");
  let fx = "",
    moved = false;
  const els: ArrayLike<Element> =
    typeof fg.querySelectorAll === "function" ? fg.querySelectorAll(".tk") : [];
  Array.from(els).forEach((el) => {
    const tid = el.getAttribute("data-tid")!,
      n = cur.get(tid)!,
      o = prev.get(tid),
      cr = n.kind === "serp" || n.kind === "shark" || n.kind === "whale";
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
    fx +=
      `<g style="transform:translate(${o.x}px,${o.y}px)"><g class="gh">${artOf(o.kind, o.col)}</g></g>` +
      G2.bubbles(o.x, o.y);
  });
  for (const k in pt) {
    if (k in tiles) continue;
    const { x, y } = POS[k]!,
      gr = { b: "gb", f: "gf", m: "gm" }[pt[k] as "b" | "f" | "m"];
    fx += `<g style="transform:translate(${x}px,${y}px)"><g class="tileout"><polygon points="${hex(0, 4)}" fill="#3a3a3a"/><polygon points="${hex(0, 0)}" fill="url(#${gr})" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round"/><g transform="translate(0,-13) scale(.8)">${deco(pt[k]!, 1)}</g></g></g>`;
  }
  if (fx) fxAdd(fx);
  if (moved) sfx("move");
}

interface TokDef {
  tid: string;
  kind: string;
  col: string;
  data: string;
  sl: boolean;
}

// Paint the board: the static layer only when a tile was removed, then highlights and tokens every
// render (which is what makes the token slide animation possible).
export function renderBoard(v: ViewState, sel: Sel, DS: string[]): void {
  const tiles = v.tiles as Record<string, { type: string }>;
  const bkey = Object.keys(tiles).join(",");
  if (bkey !== BKEY) {
    BKEY = bkey;
    let s = "";
    for (const k of CELLS) {
      const { x, y } = POS[k]!;
      const t = tiles[k];
      if (t || SAFE.includes(k)) {
        const c = t
          ? { b: "#a8863f", f: "#1f5a2c", m: "#444655" }[
              t.type as "b" | "f" | "m"
            ]
          : "#2f7a3a";
        s += `<polygon points="${hex(x + 3, y + 9)}" fill="#001a33" fill-opacity=".28" pointer-events="none"/><polygon points="${hex(x, y + 4)}" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round" pointer-events="none"/>`;
      }
    }
    for (const k of CELLS) {
      const { x, y } = POS[k]!;
      const t = tiles[k];
      const sf = SAFE.includes(k),
        h = (P(k) as number[]).reduce((a, b) => a * 7 + b, 3) % 3;
      if (t) {
        const d = { b: "gb", f: "gf", m: "gm" }[t.type as "b" | "f" | "m"];
        s += `<polygon data-k="${k}" points="${hex(x, y)}" fill="url(#${d})" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round"/><g pointer-events="none" transform="translate(${x},${y - 13}) scale(.8)">${deco(t.type, h)}</g>`;
      } else if (sf) {
        s += `<polygon data-k="${k}" points="${hex(x, y)}" fill="url(#gs)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><g transform="translate(${x},${y + 1}) scale(.9)">${G2.island()}</g>`;
      } else {
        const sh = NB(k).some((n) => tiles[n]);
        s += `<polygon data-k="${k}" points="${hex(x, y)}" fill="${sh ? "#8fdcf5" : "#fff"}" fill-opacity="${sh ? 0.2 : 0}" stroke="#fff" stroke-opacity=".1"/>`;
        if (SERP.includes(k))
          s += `<circle cx="${x}" cy="${y}" r="21" fill="none" stroke="#c77dff" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7" pointer-events="none"/>`;
        if (DOCK[k])
          s += `<polygon points="${hex(x, y)}" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/><g transform="translate(${x},${y - 14}) scale(.6)" opacity=".85" pointer-events="none">${G2.anchor()}</g>`;
      }
    }
    layers();
    $("#fg").innerHTML = s;
  }
  let s = "";
  for (const k of DS) {
    const { x, y } = POS[k]!;
    s += `<polygon class="hl" points="${hex(x, y)}" fill="#ffe066" fill-opacity=".38" stroke="#ffe066" stroke-width="3" pointer-events="none"/>`;
  }
  const L: Record<string, TokDef[]> = {};
  const add = (k: string, o: TokDef): void => {
    (L[k] = L[k] || []).push(o);
  };
  v.boats.forEach((b) =>
    add(b.k, {
      tid: "b" + b.id,
      kind: "boat",
      col: "",
      data: `data-b="${b.id}"`,
      sl: sel.b === b.id,
    }),
  );
  v.creat.forEach((c) =>
    add(c.k, {
      tid: "c" + c.id,
      kind: c.t,
      col: "",
      data: `data-c="${c.id}"`,
      sl: sel.c === c.id,
    }),
  );
  const fate = new Map<string, string>();
  v.people.forEach((p) => {
    fate.set("p" + p.id, p.loc.t);
    if (["dead", "safe", "hand"].includes(p.loc.t)) return;
    add(A.pk(v, p), {
      tid: "p" + p.id,
      kind: p.loc.t === "boat" ? "rider" : "person",
      col: C[p.o]!,
      data: `data-p="${p.id}"`,
      sl: sel.p === p.id,
    });
  });
  const cur = new Map<string, Tk>();
  for (const k in L) {
    const { x, y } = POS[k]!;
    L[k]!.forEach((o, i) => {
      const px = x + OFF[i % 7]![0]!,
        py = y + OFF[i % 7]![1]!;
      cur.set(o.tid, { x: px, y: py, k, kind: o.kind, col: o.col });
      const hit = o.kind === "person" || o.kind === "rider" ? 13 : 15;
      s += `<g class="tk" data-tid="${o.tid}" style="transform:translate(${px}px,${py}px)">${o.sl ? '<circle r="16" fill="#fff8" stroke="#ffe066" stroke-width="3" class="selr" pointer-events="none"/>' : ""}<g class="in" pointer-events="none">${artOf(o.kind, o.col)}</g><circle data-k="${k}" ${o.data} r="${hit}" fill="transparent" style="cursor:pointer"/></g>`;
    });
  }
  const tilesNow: Record<string, string> = {};
  for (const [k, t] of Object.entries(tiles)) tilesNow[k] = t.type;
  layers();
  $("#tk").innerHTML = s;
  diff(cur, tilesNow, fate);
}

// ---- viewport (pan / pinch-zoom / wheel) ---------------------------------------------------

export const BW = 750;
export const BH = 580;
const bwr = (): DOMRect => $("#bw").getBoundingClientRect();
export let VB = { x: 0, y: 0, w: BW, h: BH };
let SUP = 0;
let mv = 0;
const PT = new Map<number, [number, number]>();

export function setVB(): void {
  const r = bwr();
  VB.w = Math.min(Math.max(VB.w, 150), 900);
  VB.h = (VB.w * r.height) / Math.max(r.width, 1);
  VB.x = Math.min(Math.max(VB.x, -VB.w * 0.3), BW - VB.w * 0.7);
  VB.y = Math.min(Math.max(VB.y, -VB.h * 0.3), BH - VB.h * 0.7);
  $("#bd").setAttribute("viewBox", VB.x + " " + VB.y + " " + VB.w + " " + VB.h);
}

export function fitView(): void {
  const r = bwr(),
    asp = r.width / Math.max(r.height, 1),
    // Portrait boards, and boards squeezed short by the panels on small phones, start zoomed on the
    // island (a whole-map fit there is only ~100px tall, and the zoom buttons would cover the corners).
    cramped = r.height < 280,
    // cramped: widen the view just enough that the whole island (~340 units tall) is visible.
    // Clamp here to the same range setVB() enforces, otherwise the centre below is computed from a
    // width the viewBox never actually uses and the board ends up off-centre.
    w = Math.min(
      900,
      Math.max(
        150,
        asp < 0.85
          ? 460
          : cramped
            ? Math.max(460, 340 * asp)
            : Math.max(BW + 16, (BH + 16) * asp),
      ),
    );
  VB = { x: 375 - w / 2, y: 290 - w / asp / 2, w, h: BH };
  setVB();
}

export function zoomAt(f: number, cx: number, cy: number, nx = cx, ny = cy): void {
  const r = bwr(),
    wx = VB.x + ((cx - r.left) * VB.w) / r.width,
    wy = VB.y + ((cy - r.top) * VB.h) / r.height;
  VB.w *= f;
  setVB();
  VB.x = wx - ((nx - r.left) * VB.w) / r.width;
  VB.y = wy - ((ny - r.top) * VB.h) / r.height;
  setVB();
}

// Called at the end of a render: the panels under the board change size between phases, so the
// board is fitted once the game screen has its real size.
export function fitIfNeeded(): void {
  if (NEEDFIT) {
    NEEDFIT = false;
    fitView();
  }
}

function zoomCenter(f: number): void {
  const r = bwr();
  zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
}

export function wireViewport(): void {
  $("#bd").onclick = (e: MouseEvent): void => {
    if (SUP) {
      SUP = 0;
      return;
    }
    const S = store.S;
    if (!S || S.phase === "end") return;
    const el = (e.target as HTMLElement).closest(
      "[data-k]",
    ) as HTMLElement | null;
    if (!el) return;
    const k = el.dataset.k!;
    const d = (e.target as HTMLElement).closest(
      "[data-p],[data-b],[data-c]",
    ) as HTMLElement | null;
    if (A.dests(S, actor(), store.ui.sel || {}, store.ui.mode || undefined).includes(k))
      return H.act(k);
    if (!d) store.ui.sel = null;
    else {
      const id = +(d.dataset.p ?? d.dataset.b ?? d.dataset.c)!;
      store.ui.sel =
        d.dataset.p !== undefined
          ? { p: id }
          : d.dataset.b !== undefined
            ? { b: id }
            : { c: id };
    }
    H.render();
  };

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
  $("#zi").onclick = (): void => zoomCenter(0.75);
  $("#zo").onclick = (): void => zoomCenter(1.33);
  $("#zf").onclick = fitView;
  $("#zi").innerHTML = G2.icon("zoomin", 22);
  $("#zo").innerHTML = G2.icon("zoomout", 22);
  $("#zf").innerHTML = G2.icon("fit", 22);
  addEventListener("resize", fitView);

  // Keyboard alternative to drag/pinch (game-ui-ux "dragging needs a button/keyboard alternative"):
  // arrows pan, +/- zoom, F/Home fit. Ignored while typing in an overlay input.
  addEventListener("keydown", (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        (t as HTMLElement).isContentEditable)
    )
      return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const step = e.shiftKey ? 60 : 24;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
        VB.x -= step;
        setVB();
        break;
      case "ArrowRight":
        VB.x += step;
        setVB();
        break;
      case "ArrowUp":
        VB.y -= step;
        setVB();
        break;
      case "ArrowDown":
        VB.y += step;
        setVB();
        break;
      case "+":
      case "=":
        zoomCenter(0.85);
        break;
      case "-":
      case "_":
        zoomCenter(1.18);
        break;
      case "f":
      case "F":
      case "Home":
        fitView();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  });

  // The panels under the board grow and shrink between phases (hand cards, dialogs), which resizes
  // the board box; keep the viewBox's aspect ratio in step so the map is never letterboxed.
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(setVB).observe($("#bw"));
  fitView();
}
