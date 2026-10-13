// Authoritative game server: rooms, seats, reconnect, per-player views. Needs: npm i ws
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { RawData } from "ws";
import A from "./src/engine.js";
import type { State, Action, Ev } from "./src/engine.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
// When run as dist/server.js the project resources live one level up; when run directly they don't.
const ROOT = fs.existsSync(path.join(dir, "public"))
  ? dir
  : path.join(dir, "..");
const PORT = +(process.env.PORT || 3000);
const DATA = process.env.DATA_FILE || path.join(ROOT, "data", "rooms.json");
const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface Ctx {
  r: Room;
  i: number;
}
type Sock = WebSocket & { ctx?: Ctx | null; alive?: boolean };
interface Seat {
  token: string;
  name: string;
  ws: Sock | null;
}
interface Room {
  code: string;
  n: number;
  state: State | null;
  updated: number;
  seats: Seat[];
}
interface ClientMsg {
  type?: string;
  n?: number;
  name?: string;
  code?: string;
  token?: string;
  a?: Action;
}

const rooms = new Map<string, Room>();

const code = (): string => {
  let s: string;
  do {
    s = Array.from({ length: 5 }, () => CH[crypto.randomInt(CH.length)]).join(
      "",
    );
  } while (rooms.has(s));
  return s;
};
const clean = (n: unknown): string =>
  String(n || "")
    .replace(/[<>&"'`]/g, "")
    .trim()
    .slice(0, 16);
const tok = (): string => crypto.randomBytes(16).toString("hex");

function load(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as Room[];
    for (const r of raw)
      rooms.set(r.code, {
        ...r,
        seats: r.seats.map((s) => ({ ...s, ws: null })),
      });
  } catch {
    /* first run / unreadable file */
  }
}

let tm: ReturnType<typeof setTimeout> | undefined;
const save = (): void => {
  clearTimeout(tm);
  tm = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA), { recursive: true });
      fs.writeFileSync(
        DATA,
        JSON.stringify(
          [...rooms.values()].map((r) => ({
            code: r.code,
            n: r.n,
            state: r.state,
            updated: r.updated,
            seats: r.seats.map(({ token, name }) => ({ token, name })),
          })),
        ),
      );
    } catch (e) {
      console.error("save failed:", (e as Error).message);
    }
  }, 300);
};

const send = (ws: Sock | null | undefined, m: unknown): void => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
};
const names = (r: Room): string[] => r.seats.map((s) => s.name);
const conn = (r: Room): boolean[] =>
  r.seats.map((s) => !!(s.ws && s.ws.readyState === WebSocket.OPEN));

function broadcast(r: Room, ev: Ev[]): void {
  r.seats.forEach((s, i) => {
    if (!s.ws) return;
    if (r.state)
      send(s.ws, {
        type: "state",
        view: A.view(r.state, i),
        events: ev.filter((e) => e.type !== "reveal" || e.to === i),
        names: names(r),
        connected: conn(r),
      });
    else send(s.ws, { type: "lobby", code: r.code, n: r.n, names: names(r) });
  });
}

function attach(ws: Sock, r: Room, i: number): void {
  const s = r.seats[i]!;
  if (s.ws && s.ws !== ws) {
    s.ws.ctx = null;
    try {
      s.ws.close();
    } catch {
      /* ignore */
    }
  }
  s.ws = ws;
  ws.ctx = { r, i };
  send(ws, { type: "joined", code: r.code, seat: i, token: s.token, n: r.n });
}

function handle(ws: Sock, m: ClientMsg): void {
  const bad = (t: string): void => send(ws, { type: "error", msg: t });
  switch (m.type) {
    case "create": {
      const n = +m.n!;
      if (![2, 3, 4].includes(n)) {
        bad("تعداد بازیکن نامعتبر است.");
        return;
      }
      const r: Room = {
        code: code(),
        n,
        seats: [{ token: tok(), name: clean(m.name) || "بازیکن ۱", ws: null }],
        state: null,
        updated: Date.now(),
      };
      rooms.set(r.code, r);
      attach(ws, r, 0);
      save();
      broadcast(r, []);
      return;
    }
    case "join": {
      const r = rooms.get(String(m.code || "").toUpperCase());
      if (!r) {
        bad("اتاقی با این کد یافت نشد.");
        return;
      }
      if (r.state) {
        bad("بازی این اتاق شروع شده است.");
        return;
      }
      if (r.seats.length >= r.n) {
        bad("اتاق پر است.");
        return;
      }
      r.seats.push({
        token: tok(),
        name: clean(m.name) || "بازیکن " + (r.seats.length + 1),
        ws: null,
      });
      attach(ws, r, r.seats.length - 1);
      if (r.seats.length === r.n) r.state = A.newGame(r.n);
      r.updated = Date.now();
      save();
      broadcast(r, []);
      return;
    }
    case "rejoin": {
      const r = rooms.get(String(m.code || "").toUpperCase());
      const i = r ? r.seats.findIndex((s) => s.token === m.token) : -1;
      if (i < 0) {
        bad("اتاق یا جای تو یافت نشد.");
        return;
      }
      attach(ws, r!, i);
      broadcast(r!, []);
      return;
    }
    case "action": {
      const c = ws.ctx;
      if (!c || !c.r.state) {
        bad("هنوز بازی شروع نشده.");
        return;
      }
      const a = m.a;
      if (
        !a ||
        typeof a !== "object" ||
        typeof a.t !== "string" ||
        JSON.stringify(a).length > 300
      ) {
        bad("اکشن نامعتبر.");
        return;
      }
      const res = A.apply(c.r.state, c.i, a);
      if ("error" in res) {
        bad(res.error);
        return;
      }
      c.r.state = res.state;
      c.r.updated = Date.now();
      save();
      broadcast(c.r, res.events);
      return;
    }
  }
}

// ------------------------------------------------------------------ http

const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

function serveFile(res: ServerResponse, file: string, fallback?: string): void {
  fs.readFile(file, (e, d) => {
    if (e) {
      res.writeHead(500);
      res.end(fallback || "read error");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(d);
  });
}

const server = http.createServer((q: IncomingMessage, s: ServerResponse) => {
  const u = (q.url || "/").split("?")[0]!;
  if (u === "/" || u === "/index.html")
    return serveFile(
      s,
      path.join(ROOT, "public", "index.html"),
      "public/index.html missing — run: npm run build",
    );
  if (u === "/healthz") {
    s.writeHead(200);
    s.end("ok");
    return;
  }
  if (u.startsWith("/dist/")) {
    // compiled ES modules for the browser smoke test
    const p = path.normalize(path.join(ROOT, decodeURIComponent(u)));
    if (
      p.startsWith(ROOT + path.sep) &&
      [".js", ".mjs", ".json"].includes(path.extname(p))
    )
      return serveFile(s, p);
  }
  s.writeHead(404);
  s.end("not found");
});

const wss = new WebSocketServer({ server, maxPayload: 2048 });
wss.on("connection", (ws: Sock) => {
  ws.alive = true;
  let n = 0;
  const t = setInterval(() => {
    n = 0;
  }, 1000);
  ws.on("pong", () => {
    ws.alive = true;
  });
  ws.on("message", (raw: RawData) => {
    if (++n > 40) {
      send(ws, { type: "error", msg: "درخواست‌ها بیش از حد است؛ کمی صبر کن." });
      return;
    }
    let m: unknown;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!m || typeof m !== "object") return;
    try {
      handle(ws, m as ClientMsg);
    } catch (e) {
      console.error(e);
      send(ws, { type: "error", msg: "خطای سرور" });
    }
  });
  ws.on("close", () => {
    clearInterval(t);
    const c = ws.ctx;
    if (c && c.r.seats[c.i]!.ws === ws) {
      c.r.seats[c.i]!.ws = null;
      broadcast(c.r, []);
    }
  });
});

setInterval(
  () =>
    wss.clients.forEach((w) => {
      const s = w as Sock;
      if (!s.alive) return w.terminate();
      s.alive = false;
      w.ping();
    }),
  30000,
);
setInterval(() => {
  const old = Date.now() - 864e5;
  for (const [c, r] of rooms) if (r.updated < old) rooms.delete(c);
  save();
}, 36e5);

load();
server.listen(PORT, "0.0.0.0", () => console.log("listening on " + PORT));
