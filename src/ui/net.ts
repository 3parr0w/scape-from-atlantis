// WebSocket client: connect, per-message handling, reconnect, and the "room not found" retry that
// works around serverless hosts running several instances.
import type { Ev, ViewState } from "../engine";
import * as G2 from "../gfx";
import { store, H, ST, setST, MAX_JOIN_TRIES } from "./state";
import type { Net } from "./state";
import { $, C, esc } from "./dom";
import { log, onEv } from "./fx";
import { ov, ovShow } from "./overlay";
import { resetGfx } from "./board";

export function connect(first: Record<string, unknown>): void {
  store.HADSTATE = 0;
  resetGfx();
  if (store.NET) {
    try {
      store.NET.onclose = null;
      store.NET.close();
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
    store.NET = null;
    return H.onlineMenu("اتصال به سرور ممکن نیست.");
  }
  store.NET = ws;
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
    if (store.NET !== ws) return;
    if (!store.S && !store.LOBBY) {
      store.NET = null;
      return H.onlineMenu("اتصال به سرور ممکن نیست.");
    }
    log(G2.icon("warn", 16) + " اتصال قطع شد؛ تلاش دوباره…");
    H.render();
    setTimeout(() => {
      const s = ST();
      if (store.NET === ws && s)
        connect({ type: "rejoin", code: s.code, token: s.token });
    }, 2000);
  };
}

export function onNet(m: any): void {
  if (m.type === "error") {
    if (!store.S && !store.LOBBY) {
      if (/یافت نشد/.test(m.msg)) setST(null);
      store.NET = null;
      // A serverless host may have answered from an instance that does not own the room yet.
      // Retry the same join on a fresh connection before giving up.
      const p0 = store.PENDING;
      if (
        p0 &&
        /اتاقی با این کد یافت نشد/.test(m.msg) &&
        p0.tries < MAX_JOIN_TRIES
      ) {
        p0.tries++;
        ov(
          `<h3>در حال اتصال…</h3><p>اتاق پیدا نشد؛ تلاش دوباره (${p0.tries} از ${MAX_JOIN_TRIES})</p>`,
          null,
          true,
        );
        setTimeout(() => {
          if (store.PENDING === p0)
            connect({ type: "join", code: p0.code, name: p0.name });
        }, 1000);
        return;
      }
      const p = store.PENDING;
      store.PENDING = null;
      return H.onlineMenu(m.msg, p?.name, p?.code);
    }
    log(G2.icon("warn", 16) + " " + m.msg);
    return H.render();
  }
  if (m.type === "joined") {
    store.PENDING = null;
    store.CODE = m.code;
    store.ME = m.seat;
    setST({ code: m.code, token: m.token });
    return;
  }
  if (m.type === "lobby") {
    store.NAMES = m.names;
    store.LOBBY = 1;
    store.OQ = [];
    ov(
      `<h3>اتاق <b>${esc(m.code)}</b></h3><p>${m.names.length} از ${m.n} نفر وصل شده‌اند:</p><p>${m.names.map((x: string, i: number) => `<span style="color:${C[i]}">${G2.icon("dot", 12)} ${esc(x)}</span>`).join("<br>")}</p><p>کد را برای دوستانت بفرست، یا این لینک:<br><small dir="ltr">${esc(location.origin + location.pathname + "?room=" + m.code)}</small></p>`,
      null,
      true,
    );
    return;
  }
  if (m.type === "state") {
    // The first state of a game (or a fresh connection) closes any lobby / menu overlay.
    // The joining player never receives a lobby message (the server sets state before it
    // broadcasts), so clearing on the first state is what lets player 2 actually play.
    if (store.LOBBY || !store.HADSTATE) {
      store.LOBBY = 0;
      store.HADSTATE = 1;
      store.OQ = [];
      ovShow();
    }
    store.NAMES = m.names;
    store.CONN = m.connected;
    const view = m.view as ViewState;
    store.S = view as unknown as typeof store.S;
    store.ME = view.me;
    if (store.S!.phase !== "play") store.ui.mode = null;
    store.ui.sel = null;
    store.ui.card = null;
    (m.events as Ev[]).forEach(onEv);
    if (store.S!.over && !store.ENDED) onEv({ type: "end" });
    H.render();
    const k = store.S!.pending ? JSON.stringify(store.S!.pending) : "";
    if (k && store.S!.pending!.queue[0] === store.ME && k !== store.PK) {
      store.PK = k;
      H.prompt();
    }
    if (!k) store.PK = "";
  }
}
