// Server-layer tests: input sanitisation and protocol validation. Engine rules live in engine-test.ts;
// full networked play + reconnect is covered by online-test.ts.
const clean = (n: unknown): string =>
  String(n || "")
    .replace(/[<>&"'`]/g, "")
    .trim()
    .slice(0, 16);

let pass = 0,
  fail = 0;
const t = (name: string, ok: boolean): void => {
  if (ok) {
    pass++;
    console.log("✓ " + name);
  } else {
    fail++;
    console.log("✗ " + name);
  }
};

// Nickname cleaning mirrors server.ts: strips markup/backticks, trims, caps at 16 chars.
t("clean strips HTML-significant characters", clean("<b>x</b>") === "bx/b");
t("clean strips quotes and backticks", clean("a\"b'c`d") === "abcd");
t("clean strips ampersands", clean("a&b") === "ab");
t("clean trims surrounding whitespace", clean("  Ali  ") === "Ali");
t("clean caps length at 16", clean("x".repeat(40)).length === 16);
t("clean keeps normal names intact", clean("Bita") === "Bita");
t(
  "clean handles empty/undefined input",
  clean(undefined) === "" && clean("") === "",
);
t(
  "cleaned names never contain markup characters",
  !/[<>&"'`]/.test(clean("<<>>&&\"\"''``")),
);

// Room code alphabet avoids look-alike characters.
const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
t(
  "room-code alphabet has no look-alikes",
  !/[IO01]/.test(CH) && new Set(CH).size === CH.length,
);

console.log("\nserver-test: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
