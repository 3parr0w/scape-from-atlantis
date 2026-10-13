// Starts the real server, connects 3 websocket clients, plays a full random game through the network
// (using only per-player views), reconnects one player mid-game, and checks that no secrets reach other players.
import { spawn } from "node:child_process";
import WebSocket from "ws";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { choose } from "./bot.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const PORT = 3100 + Math.floor(Math.random() * 800);
const DATA = path.join(os.tmpdir(), "atl-test-" + PORT + ".json");
const srv = spawn(process.execPath, [path.join(root, "dist", "server.js")], {
  env: { ...process.env, PORT: String(PORT), DATA_FILE: DATA },
  stdio: ["ignore", "pipe", "inherit"],
});
const fail = (m: string): void => {
  console.log("FAIL:", m);
  srv.kill();
  process.exit(1);
};
setTimeout(() => fail("timeout"), 90000);

let code = "",
  sent = 0,
  leaks = 0,
  expectedErrors = 0,
  unexpectedErrors = 0,
  reconnected = false,
  done = 0;
const C: any[] = [];
const send = (c: any, m: any): void => c.ws.send(JSON.stringify(m));

function mk(i: number, name: string): any {
  const c: any = {
    i,
    name,
    view: null,
    token: null,
    seat: null,
    over: false,
    expectErr: 0,
  };
  bind(c, new WebSocket("ws://localhost:" + PORT));
  if (i < 3) C[i] = c;
  return c;
}

function bind(c: any, ws: WebSocket): void {
  c.ws = ws;
  ws.on("message", (d: any) => {
    const m = JSON.parse(d.toString());
    if (m.type === "joined") {
      c.token = m.token;
      c.seat = m.seat;
      code = m.code;
    }
    if (m.type === "error") {
      if (c.expectErr) {
        c.expectErr--;
        expectedErrors++;
      } else {
        unexpectedErrors++;
        console.log("unexpected error", c.i, m.msg);
      }
    }
    if (m.type === "state") {
      const v = m.view;
      c.view = v;
      if (Object.values(v.tiles).some((t: any) => "cont" in t)) leaks++;
      if (!v.over && v.people.some((p: any) => p.o !== c.seat && p.n !== null))
        leaks++;
      v.hands.forEach((h: any[], o: number) => {
        if (o !== c.seat && h.some((x) => x !== null)) leaks++;
      });
      if (m.events.some((e: any) => e.type === "reveal" && e.to !== c.seat))
        leaks++;
      if (v.over) {
        if (!c.over) {
          c.over = true;
          done++;
          if (done === C.length) finish();
        }
        return;
      }
      const actor = v.pending ? v.pending.queue[0] : v.cur;
      if (actor === c.seat)
        setTimeout(() => {
          if (c.view !== v || c.ws !== ws) return;
          sent++;
          if (sent === 150 && !reconnected) {
            reconnected = true;
            return reconnect(C[1]);
          }
          let a: any;
          try {
            a = choose(v, c.seat);
          } catch (e) {
            console.log("BOT THREW", (e as Error).message, v.phase, v.roll);
            return;
          }
          send(c, { type: "action", a });
        }, 25);
    }
  });
}

function reconnect(c: any): void {
  c.ws.terminate();
  setTimeout(() => {
    const ws = new WebSocket("ws://localhost:" + PORT);
    bind(c, ws);
    ws.on("open", () => send(c, { type: "rejoin", code, token: c.token }));
  }, 300);
}

function finish(): void {
  const r = C[0].view.result;
  console.log(
    "online test: game finished, scores",
    r.map((x: any) => x.total).join("/"),
    "| actions",
    sent,
    "| expected errors",
    expectedErrors,
  );
  if (leaks) fail("secret leak x" + leaks);
  if (unexpectedErrors) fail("unexpected errors");
  if (!reconnected) fail("reconnect not exercised");
  console.log("online test: OK (no leaks, reconnect worked)");
  srv.kill();
  process.exit(0);
}

srv.stdout!.on("data", async (d: any) => {
  if (!/listening/.test(String(d)) || C.length) return;
  const a = mk(0, "Ali"),
    wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  a.ws.on("open", async () => {
    send(a, { type: "create", n: 3, name: "Ali <b>" });
    await wait(200);
    const b = mk(1, "Bita");
    b.ws.on("open", () => send(b, { type: "join", code, name: "Bita" }));
    await wait(200);
    const bad = mk(9, "x");
    bad.expectErr = 3;
    bad.ws.on("open", () => {
      send(bad, { type: "join", code: "ZZZZZ" });
      send(bad, { type: "rejoin", code, token: "nope" });
      send(bad, { type: "action", a: { t: "roll" } });
    });
    await wait(200);
    const c = mk(2, "Cyrus");
    c.ws.on("open", () => send(c, { type: "join", code, name: "Cyrus" }));
    await wait(300);
    b.expectErr = 1;
    send(b, { type: "action", a: { t: "placePerson", k: "0,0" } });
    const late = mk(8, "late");
    late.expectErr = 1;
    late.ws.on("open", () => send(late, { type: "join", code, name: "late" }));
  });
});
