// Presentation side effects: the game log, transient SVG effects, the die animation, and the
// mapping from engine events to what the player sees/hears.
import type { Ev, ContentType } from "../engine";
import * as G2 from "../gfx";
import { sfx } from "../sfx";
import { store, nm } from "./state";
import { ov } from "./overlay";
import { $, C, CR, POS, T, esc } from "./dom";

export function log(m: string): void {
  store.LG.unshift(m);
  store.LG.length = Math.min(store.LG.length, 6);
}

// Add transient effects to the persistent #fx layer; they remove themselves.
export function fxAdd(html: string, ms = 1800): void {
  const fx = $("#fx");
  if (!fx || typeof fx.insertAdjacentHTML !== "function") return;
  const before = fx.childElementCount;
  fx.insertAdjacentHTML("beforeend", html);
  const added = Array.from(fx.children).slice(before) as Element[];
  setTimeout(() => added.forEach((e) => e.remove()), ms);
}

export function showDie(face: string): void {
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

export function fxTook(e: { k: string; cont: ContentType | null }): void {
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

export function fxHit(k: string): void {
  const p = POS[k];
  if (p) fxAdd(G2.ripple(p.x, p.y) + G2.bubbles(p.x, p.y));
}

export function onEv(e: Ev): void {
  switch (e.type) {
    case "reveal": {
      const i = T[e.cont]!;
      // Auto-dismiss so the tile is shown clearly but never blocks the next step.
      ov(
        `<div class="rvart">${G2.cardSvg(e.cont)}</div><h3>${i[1]}</h3><p>${i[2]}</p>`,
        null,
        false,
        12000,
      );
      break;
    }
    case "took":
      fxTook(e);
      log(
        nm(e.pl) +
          " کاشی برداشت: " +
          (e.cont ? T[e.cont]![0] + " " + T[e.cont]![1] : "(مخفی)"),
      );
      break;
    case "saved":
      sfx("saved");
      log(nm(e.pl) + " یک نفر را نجات داد.");
      break;
    case "roll":
      showDie(e.face);
      sfx("roll");
      log(
        nm(e.pl) +
          " تاس ریخت: " +
          G2.creatureIcon(e.face, 20) +
          " " +
          CR[e.face],
      );
      break;
    case "cmove":
      sfx("splash");
      log(
        nm(e.pl) +
          " " +
          G2.creatureIcon(e.t, 20) +
          " " +
          CR[e.t] +
          " را حرکت داد.",
      );
      break;
    case "defended":
      sfx("shield");
      log(
        nm(e.pl) + " " + T[e.tile]![0] + " «" + T[e.tile]![1] + "» را بازی کرد.",
      );
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
      if (store.NET) {
        log("نوبت " + nm(e.cur) + " است.");
        if (e.cur === store.ME) {
          document.title = "نوبت توست — فرار از آتلانتیس";
          sfx("turn");
        }
        break;
      }
      ov(
        `<div class="av big" style="--c:${C[e.cur]}">${escFirst(nm(e.cur))}</div><h3>${esc(nm(e.cur))}</h3><p>نوبت <b style="color:${C[e.cur]}">${esc(nm(e.cur))}</b> است.<br>صفحه را به او بدهید.</p>`,
      );
      break;
    case "end": {
      store.ENDED = 1;
      const R = store.S!.result!;
      const b = Math.max(...R.map((r) => r.total));
      ov(
        `<div class="rvart">${G2.cardSvg("volc")}</div><h3>پایان بازی</h3>` +
          R.map(
            (r) =>
              `<p style="color:${C[r.o]}"><b>${nm(r.o)}</b>: ${r.nums.length} نفر [${r.nums.join("+") || "—"}] = <b>${r.total}</b>${r.total === b ? " " + G2.icon("trophy", 16) : ""}</p>`,
          ).join("") +
          '<p><button onclick="location.reload()">بازی جدید</button></p>',
        null,
        true,
      );
    }
  }
}

// The avatar bubble shows the first grapheme of the name, escaped.
const escFirst = (s: string): string => esc(Array.from(s)[0] || "?");
