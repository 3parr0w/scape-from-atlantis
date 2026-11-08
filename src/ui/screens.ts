// Screen flow: main menu, local setup, online menu/lobby entry, and starting a local game.
import A from "../engine";
import { store, H, ST } from "./state";
import { $, C, PN, cleanName, esc, val } from "./dom";
import { ov } from "./overlay";
import { resetGfx } from "./board";

export function go(n: number, names?: string[]): void {
  resetGfx();
  store.NET = null;
  store.NAMES = names || [];
  store.OQ = [];
  $("#ov").style.display = "none";
  store.S = A.newGame(n);
  store.LG = [
    "چیدن: هر بازیکن به نوبت یک مهره روی یک کاشی خالی می‌گذارد.",
  ];
  H.render();
  ov(
    "<h3>چیدن مهره‌ها</h3><p>هر بازیکن به نوبت یک مهره روی یک کاشی خالی می‌گذارد، بعد قایق‌ها. «نمایش اعداد» را فقط در نوبت خودت بزن و عدد را به خاطر بسپار.</p>",
  );
}

export function menu(): void {
  store.PENDING = null;
  store.OQ = [];
  const s = ST();
  ov(
    `<h3>فرار از آتلانتیس</h3><p><button onclick="localMenu()">بازی محلی (یک صفحه)</button></p><p><button onclick="onlineMenu()">بازی آنلاین</button></p>${s ? `<p><button class="g" onclick="resume()">ادامه‌ی بازی قبلی (${esc(s.code)})</button></p>` : ""}<p style="font-size:11px;opacity:.6;margin:.8em 0 0">آیکون‌ها: Fluent Emoji (MIT) و game-icons.net (CC BY 3.0)</p>`,
    null,
    true,
  );
}

export function localMenu(): void {
  store.OQ = [];
  ov(
    '<h3>چند بازیکن؟</h3><p><button class="g" onclick="localNames(2)">۲</button> <button class="g" onclick="localNames(3)">۳</button> <button class="g" onclick="localNames(4)">۴</button></p><p><button class="g" onclick="menu()">بازگشت</button></p>',
    null,
    true,
  );
}

export function localNames(n: number): void {
  store.OQ = [];
  ov(
    "<h3>نام بازیکن‌ها</h3>" +
      Array.from(
        { length: n },
        (_, i) =>
          `<p><i class="dot" style="background:${C[i]}"></i><input id="ln${i}" placeholder="${PN[i]}" maxlength="16"></p>`,
      ).join("") +
      `<p><button onclick="startLocal(${n})">شروع بازی</button> <button class="g" onclick="localMenu()">بازگشت</button></p>`,
    null,
    true,
  );
}

export function startLocal(n: number): void {
  go(
    n,
    Array.from({ length: n }, (_, i) => cleanName(val("#ln" + i)) || PN[i]!),
  );
}

export function onlineMenu(msg?: string, name?: string, code?: string): void {
  store.OQ = [];
  const q = code ?? (new URLSearchParams(location.search).get("room") || "");
  // The overlay inputs use their own ids (#jnm / #jcd). They must NOT reuse ids that already
  // exist in the shell (e.g. #cd is the card-description div in the status bar): querySelector
  // returns the first match in document order, so a duplicate id would read the wrong element
  // and the join would send an empty room code.
  ov(
    `<h3>بازی آنلاین</h3><p><input id="jnm" placeholder="نام تو" maxlength="16" value="${esc(name ?? "")}"></p><p>ساخت اتاق: <button onclick="mkRoom(2)">۲</button> <button onclick="mkRoom(3)">۳</button> <button onclick="mkRoom(4)">۴</button> نفره</p><p><input id="jcd" placeholder="کد اتاق" maxlength="5" value="${esc(q)}" style="text-transform:uppercase"> <button onclick="joinRoom()">ورود</button></p><p style="color:#e63946">${msg ? esc(msg) : ""}</p><p><button class="g" onclick="menu()">بازگشت</button></p>`,
    null,
    true,
  );
}

export function mkRoom(n: number): void {
  store.PENDING = null;
  H.connect({ type: "create", n, name: val("#jnm") });
}

export function joinRoom(): void {
  const code = val("#jcd").toUpperCase().trim();
  const name = val("#jnm");
  store.PENDING = { code, name, tries: 0 };
  H.connect({ type: "join", code, name });
}

export function resume(): void {
  store.PENDING = null;
  const s = ST();
  if (s) H.connect({ type: "rejoin", code: s.code, token: s.token });
}
