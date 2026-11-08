// Modal screen stack: push (ov), show the newest, pop (closeOverlay). The stack semantics are what
// keep a tile reveal or a lobby update from hiding behind a stale dialog, and they give keyboard
// users a single Escape target (the top overlay).
import type { Overlay } from "./state";
import { store } from "./state";
import { $, canFocus } from "./dom";

let OVC = 0;

export function ov(
  h: string,
  cb?: (() => void) | null,
  raw?: boolean,
  autoMs?: number,
): void {
  const o: Overlay = { h, cb, raw, id: ++OVC };
  store.OQ.push(o);
  if (autoMs) setTimeout(() => closeOverlay(o), autoMs);
  ovShow();
}

// Show the newest overlay. A newer entry replaces whatever is on screen, so a tile reveal or a lobby
// update is never hidden behind a stale modal (this was why online reveals silently didn't appear).
// Screen-stack semantics for modals: opening one moves focus into it and makes the game behind it
// inert, closing restores focus to whatever had it before. Without this a keyboard user tabs into
// the board behind the dialog and can never reach the dialog's buttons.
export function ovShow(): void {
  const o = store.OQ[store.OQ.length - 1];
  if (!o) {
    $("#ov").style.display = "none";
    $("#app").inert = false;
    if (canFocus(store.LASTFOCUS)) store.LASTFOCUS.focus();
    store.LASTFOCUS = null;
    return;
  }
  if (!store.LASTFOCUS && typeof document !== "undefined" && document.activeElement)
    store.LASTFOCUS = (document as unknown as { activeElement: any })
      .activeElement;
  $("#ovb").innerHTML =
    o.h + (o.raw ? "" : '<p><button id="ok">باشه</button></p>');
  $("#ov").style.display = "flex";
  $("#app").inert = true;
  if (!o.raw) $("#ok").onclick = () => closeOverlay(o);
  const first = $("#ovb button") || $("#ok");
  if (canFocus(first)) first.focus();
}

export function closeOverlay(o: Overlay): void {
  const i = store.OQ.indexOf(o);
  if (i >= 0) store.OQ.splice(i, 1);
  ovShow();
}

export function clearOverlays(): void {
  store.OQ = [];
  ovShow();
}

// Keyboard: Escape closes the top overlay (menus included, so a keyboard-only player is never stuck).
if (
  typeof document !== "undefined" &&
  typeof document.addEventListener === "function"
)
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const top = store.OQ[store.OQ.length - 1];
    if (top) {
      e.preventDefault();
      closeOverlay(top);
    }
  });
