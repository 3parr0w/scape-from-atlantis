// Mutable application state + the tiny hook table that breaks import cycles between UI modules.
// Modules read/write `store` directly; anything that must call back into the entry module goes
// through `H` (assigned once by ui.ts before the first screen is shown).
import A from "../engine";
import type { State, ViewState, Sel } from "../engine";
import { PN } from "./dom";

export interface Net {
  readyState: number;
  send(d: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
}

export interface Overlay {
  h: string;
  cb?: (() => void) | null;
  raw?: boolean;
  id: number;
}

export interface UiState {
  sel: Sel | null;
  mode: string | null;
  pick: number | null;
  peek: boolean;
  card: string | null;
}

export interface Pending {
  code: string;
  name: string;
  tries: number;
}

export const store = {
  S: null as State | null,
  ui: {
    sel: null,
    mode: null,
    pick: null,
    peek: false,
    card: null,
  } as UiState,
  LG: [] as string[],
  OQ: [] as Overlay[],
  NET: null as Net | null,
  ME: 0,
  CODE: "",
  NAMES: [] as string[],
  CONN: [] as boolean[],
  PK: "",
  ENDED: 0,
  LOBBY: 0,
  HADSTATE: 0, // whether a game state has arrived on the current connection
  PENDING: null as Pending | null,
  LASTFOCUS: null as any,
};

export const MAX_JOIN_TRIES = 3;

// Display name of a player: the chosen name, or the colour name. Names are sanitised on input/server.
export const nm = (o: number): string => store.NAMES[o] || PN[o]!;

export const actor = (): number =>
  store.NET
    ? store.ME
    : store.S!.pending
      ? store.S!.pending.queue[0]!
      : store.S!.cur;

export const V = (): ViewState =>
  store.NET
    ? (store.S as unknown as ViewState)
    : A.view(store.S!, actor());

// ---- persisted session (versioned so a future shape change can be migrated) ----
const SES = "atlantis-session";

export interface Session {
  v?: number;
  code: string;
  token: string;
}

export const ST = (): Session | null => {
  try {
    const raw = localStorage.getItem(SES);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Session> | null;
    if (!o || typeof o.code !== "string" || typeof o.token !== "string")
      return null;
    return { v: o.v ?? 1, code: o.code, token: o.token };
  } catch {
    return null;
  }
};

export const setST = (o: Session | null): void => {
  try {
    if (o) localStorage.setItem(SES, JSON.stringify({ v: 1, ...o }));
    else localStorage.removeItem(SES);
  } catch {
    /* ignore */
  }
};

// ---- hook table (assigned by ui.ts) ----
export interface Hooks {
  render(): void;
  connect(first: Record<string, unknown>): void;
  onlineMenu(msg?: string, name?: string, code?: string): void;
  prompt(): void;
  act(k: string): void;
}

export const H = {} as Hooks;
