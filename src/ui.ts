// Browser entry point: owns the action dispatch loop, the HUD render, and the wiring between the
// extracted UI modules (dom / state / overlay / fx / board / net / screens).
import A from "./engine";
import type { Action, ContentType } from "./engine";
import * as G2 from "./gfx";
import { isMuted, pauseAudio, resumeAudio, toggleMute } from "./sfx";
import { store, actor, nm, V, H } from "./ui/state";
import type { Net } from "./ui/state";
import { $, C, CR, T, esc, plain } from "./ui/dom";
import { log, onEv } from "./ui/fx";
import { ov, ovShow } from "./ui/overlay";
import {
  fitIfNeeded,
  renderBoard,
  resetGfx,
  wireViewport,
} from "./ui/board";
import { connect, onNet } from "./ui/net";
import {
  go,
  joinRoom,
  localMenu,
  localNames,
  menu,
  mkRoom,
  onlineMenu,
  resume,
  startLocal,
} from "./ui/screens";

function dispatch(a: Action): void {
  if (store.NET) {
    if (store.NET.readyState !== 1) {
      log(G2.icon("warn", 16) + " اتصال برقرار نیست");
      return render();
    }
    store.NET.send(JSON.stringify({ type: "action", a }));
    store.ui.sel = null;
    store.ui.card = null;
    if (a.t === "placePerson") {
      store.ui.pick = null;
      store.ui.peek = false;
    }
    return;
  }
  const r = A.apply(store.S!, actor(), a);
  if ("error" in r) {
    log(G2.icon("warn", 16) + " " + r.error);
    return render();
  }
  store.S = r.state;
  store.ui.sel = null;
  store.ui.card = null;
  if (store.S.phase !== "play") store.ui.mode = null;
  if (a.t === "placePerson") {
    store.ui.pick = null;
    store.ui.peek = false;
  }
  r.events.forEach(onEv);
  render();
  if (store.S.pending) prompt();
}

function act(k: string): void {
  const s = store.ui.sel || {},
    m = store.ui.mode,
    ph = store.S!.phase;
  dispatch(
    ph === "setP"
      ? { t: "placePerson", k, id: store.ui.pick ?? undefined }
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

const U = {
  card(t: string): void {
    const usable =
      !!store.S &&
      store.S.phase === "play" &&
      t !== "rshark" &&
      t !== "rwhale" &&
      !(store.NET && store.S.cur !== store.ME);
    if (usable) {
      store.ui.mode = store.ui.mode === t ? null : t;
      store.ui.sel = null;
      store.ui.card = store.ui.mode ? t : null;
    } else store.ui.card = store.ui.card === t ? null : t;
    render();
  },
  tile(t: string): void {
    store.ui.mode = t;
    store.ui.sel = null;
    render();
  },
  skip: (): void => dispatch({ t: "skipTile" }),
  done: (): void => dispatch({ t: "endMoves" }),
  roll: (): void => dispatch({ t: "roll" }),
  skipC: (): void => dispatch({ t: "skipCreature" }),
  undo: (): void => dispatch({ t: "undo" }),
  peek(): void {
    store.ui.peek = !store.ui.peek;
    render();
  },
  pick(i: number): void {
    store.ui.pick = i;
    render();
  },
};

function prompt(): void {
  const d = store.S!.pending!;
  const t = d.tile;
  const o = d.queue[0]!;
  if (store.NET && o !== store.ME) return;
  ov(
    `<div class="rvart">${G2.cardSvg(t)}</div><h3>بازیکن <span style="color:${C[o]}">${nm(o)}</span></h3><p>${t === "rshark" ? "کوسه به شناگر تو رسیده." : "نهنگ به قایقی که کنترل می‌کنی رسیده."}${store.NET ? "" : "<br>صفحه را به او بدهید."}</p><p><button onclick="defend(1)">بازی کردن «${T[t]![1]}»</button> <button class="g" onclick="defend(0)">پاس</button></p>`,
    null,
    true,
  );
}

function defend(p: number): void {
  store.OQ.pop();
  dispatch({ t: "defend", play: !!p });
  ovShow();
}

// The sound button reflects (and stores) the mute state; its icon is redrawn on every change.
function syncSound(): void {
  const b = $("#zm"),
    m = isMuted();
  b.innerHTML = G2.icon(m ? "mute" : "sound", 22);
  b.setAttribute("aria-pressed", m ? "true" : "false");
  b.setAttribute(
    "title",
    m
      ? "صدا خاموش است — برای روشن کردن بزن"
      : "صدا روشن است — برای خاموش کردن بزن",
  );
}

// ---- HUD render ----------------------------------------------------------------------------

function render(): void {
  if (!store.S) return;
  const v = V(),
    me = actor(),
    DS = A.dests(store.S, me, store.ui.sel || {}, store.ui.mode || undefined);
  renderBoard(v, store.ui.sel || {}, DS);

  const ph = v.phase,
    turnOf = v.pending ? v.pending.queue[0]! : v.cur,
    h = (v.hands[me] || []).filter((t): t is ContentType => !!t),
    mine = v.people.filter((p) => p.o === me && p.loc.t === "hand"),
    waiting =
      !!store.NET &&
      ph !== "end" &&
      (v.pending ? v.pending.queue[0] !== store.ME : v.cur !== store.ME),
    defensive = (t: string): boolean => t === "rshark" || t === "rwhale",
    canUse = (t: string): boolean => ph === "play" && !waiting && !defensive(t),
    UB =
      v.canUndo && !waiting
        ? '<button class="g" onclick="U.undo()">' +
          G2.icon("undo", 16, "ic ic-rtl") +
          " برگردان</button>"
        : "";
  let st = "",
    bt = "";
  if (ph === "setP")
    st = `یک مهره انتخاب کن و روی کاشی روشن بگذار (${mine.length} مانده).`;
  if (ph === "setB")
    st = `یک خانه‌ی دریایی کنار جزیره برای قایق بزن (${v.boatsLeft[me]} مانده).`;
  if (ph === "play")
    st = store.ui.mode
      ? "مهره یا موجود را انتخاب کن و خانه‌ی روشن را بزن."
      : "کاشی دستی بازی کن، یا بدون کاشی ادامه بده.";
  if (ph === "move") st = "مهره یا قایقت را انتخاب کن و خانه‌ی روشن را بزن.";
  if (ph === "take") st = "یکی از کاشی‌های روشن را بردار.";
  if (ph === "roll") st = "تاس موجودات را بریز.";
  if (ph === "creature")
    st = `تاس: ${CR[v.roll!]} ${v.creat.some((c) => c.t === v.roll) ? "— موجود را انتخاب و حرکت بده." : "(روی تخته نیست)"}`;
  if (ph === "end") st = "بازی تمام شد.";
  if (!waiting) {
    if (ph === "setP")
      bt = `<button class="g" onclick="U.peek()">${store.ui.peek ? "پنهان کردن اعداد" : "نمایش اعداد من"}</button>`;
    if (ph === "play")
      bt =
        UB +
        `<button class="pri" onclick="U.skip()">${h.some(canUse) ? "بدون کاشی ادامه بده" : "ادامه"}</button>`;
    if (ph === "move")
      bt = UB + '<button class="pri" onclick="U.done()">پایان حرکت‌ها</button>';
    if (ph === "roll")
      bt =
        '<button class="pri big" onclick="U.roll()">' +
        G2.icon("dice", 20) +
        " ریختن تاس</button>";
    if (ph === "creature")
      bt = v.creat.some((c) => c.t === v.roll)
        ? '<button class="g" onclick="U.skipC()">رد کردن</button>'
        : '<button class="pri" onclick="U.skipC()">پایان نوبت</button>';
  }
  if (waiting)
    st = v.pending
      ? "منتظر تصمیم " + nm(v.pending.queue[0]!) + "…"
      : "نوبت " + nm(v.cur) + " است…";
  // step indicator (+ whose turn) -------------------------------------------------------------
  const setup = ph === "setP" || ph === "setB";
  const steps = setup
    ? ["مهره‌ها", "قایق‌ها"]
    : ["کاشی", "حرکت", "برداشت", "تاس"];
  const idx =
    ph === "setP"
      ? 0
      : ph === "setB"
        ? 1
        : ph === "play"
          ? 0
          : ph === "move"
            ? 1
            : ph === "take"
              ? 2
              : 3;
  // The rolled creature is shown as a chip beside the step bar, with the same art as the board.
  const rollChip =
    ph === "creature" && v.roll
      ? `<span class="rollc" title="${CR[v.roll]}" aria-label="${CR[v.roll]}">${G2.creatureIcon(v.roll, 22)}</span>`
      : "";
  $("#stph").innerHTML =
    ph === "end"
      ? ""
      : `<span class="who" style="background:${C[turnOf]}">${esc(nm(turnOf))}</span>${rollChip}<ol class="stp">` +
        steps
          .map(
            (l, n) =>
              `<li class="${n < idx ? "dn" : n === idx ? "on" : ""}"><i>${n + 1}</i>${l}${ph === "move" && n === 1 ? ` <s class="pips">${[0, 1, 2].map((i) => G2.pip(i < v.moves)).join("")}</s>` : ""}</li>`,
          )
          .join("") +
        "</ol>";
  // own hand as cards (always visible, so you know what you hold); meeples to place during setup ----
  let tray = "";
  if (ph === "setP" && !waiting) {
    const pk0 = store.ui.pick ?? (mine[0] || {}).id;
    tray = mine
      .map(
        (p) =>
          `<button class="tc pm${pk0 === p.id ? " sel" : ""}" onclick="U.pick(${p.id})"><svg viewBox="-12 -14 24 26" width="34" height="38">${G2.person(C[me]!)}</svg><b>${store.ui.peek ? p.n : "?"}</b></button>`,
      )
      .join("");
  } else if (h.length) {
    tray = h
      .map(
        (t) =>
          `<button class="tc ${defensive(t) ? "d" : "u"}${store.ui.mode === t ? " sel" : ""}${canUse(t) || defensive(t) ? "" : " dim"}" onclick="U.card('${t}')"><svg viewBox="-26 -20 52 40" width="56" height="43">${G2.cardArt(t)}</svg><span>${T[t]![1]}</span>${defensive(t) ? "<em>دفاعی</em>" : ""}</button>`,
      )
      .join("");
  }
  const owner = store.NET ? "تو" : esc(nm(me));
  $("#hand").innerHTML = tray
    ? `<div class="th">${setup ? "مهره‌های" : "کاشی‌های"} ${owner} (${setup ? mine.length : h.length})</div><div class="tr">${tray}</div>`
    : "";
  $("#cd").innerHTML =
    store.ui.card && h.includes(store.ui.card as ContentType)
      ? `<b>${T[store.ui.card]![1]}</b> — ${T[store.ui.card]![2]}`
      : "";
  $("#st").textContent = st;
  $("#bt").innerHTML = bt;
  // player cards ------------------------------------------------------------------------------
  $("#sc").innerHTML = [...Array(v.n).keys()]
    .map((o) => {
      const ps = v.people.filter((p) => p.o === o),
        f = (x: (p: any) => boolean): number => ps.filter(x).length,
        off = !!store.NET && store.CONN[o] === false,
        tags = [
          store.NET && o === store.ME ? "تو" : "",
          o === turnOf ? "نوبت" : "",
          off ? "قطع" : "",
        ]
          .filter(Boolean)
          .join(" · ");
      return `<div class="pc${o === turnOf ? " cur" : ""}${off ? " off" : ""}" style="--c:${C[o]}"><span class="av">${esc(Array.from(nm(o))[0] || "?")}</span><div class="pi"><b>${esc(nm(o))}</b><small>${tags}</small><div class="ps"><span><b>${f((p) => p.loc.t === "safe")}</b>نجات</span><span><b>${f((p) => !["safe", "dead", "hand"].includes(p.loc.t))}</b>خطر</span><span><b>${f((p) => p.loc.t === "dead")}</b>تلف</span><span><b>${v.hands[o]!.length}</b>کاشی</span></div></div></div>`;
    })
    .join("");
  // Phones fit ~2.5 player cards in the strip; keep the card of whoever's turn it is in view.
  // (optional calls: the ui-smoke test runs against a minimal fake DOM without these methods)
  $("#sc")
    .querySelector?.(".pc.cur")
    ?.scrollIntoView?.({ inline: "center", block: "nearest" });
  $("#lg").innerHTML =
    (store.NET ? "کد اتاق: <b>" + esc(store.CODE) + "</b><br>" : "") +
    store.LG.join("<br>");
  $("#lgs").textContent =
    (store.NET ? "[" + store.CODE + "] " : "") +
    (store.LG[0] ? plain(store.LG[0]) : "گزارش");
  fitIfNeeded();
}

// ---- wiring --------------------------------------------------------------------------------

H.render = render;
H.connect = connect;
H.onlineMenu = onlineMenu;
H.prompt = prompt;
H.act = act;

wireViewport();
syncSound();
$("#zm").onclick = (): void => {
  toggleMute();
  syncSound();
};

// Mobile/desktop lifecycle: release the audio device while the tab is hidden (mobile-games
// "interruptions: pause on background"), and resume when the player comes back.
if (
  typeof document !== "undefined" &&
  typeof document.addEventListener === "function"
)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAudio();
    else resumeAudio();
  });

// Expose the handlers referenced by inline onclick attributes, plus a hook for the UI smoke test.
const G = globalThis as unknown as Record<string, unknown>;
Object.assign(G, {
  U,
  go,
  menu,
  localMenu,
  localNames,
  startLocal,
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
  get S() {
    return store.S;
  },
  setNet(n: Net | null, me: number): void {
    store.NET = n;
    store.ME = me;
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
