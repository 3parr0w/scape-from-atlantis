// Builds the browser app and the Node build. Run after editing anything in src/ or server.ts.
//   node tools/build.mjs                 type-check (app, strict) + bundle + Node build
//   node tools/build.mjs --no-check      skip the strict type-check
//   node tools/build.mjs --browser-only  only rebuild public/index.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const abs = (p) => join(root, p);
const rd = (p) => readFileSync(abs(p), "utf8");
const arg = (n) => process.argv.includes(n);
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");

// 1) Strict type-check of the application (src + server) via tsconfig.json.
if (!arg("--no-check"))
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
    cwd: root,
    stdio: "inherit",
  });

// 2) Bundle the engine + UI into a single self-contained <script> body.
const result = await build({
  entryPoints: [abs("src/ui.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  write: false,
  legalComments: "inline",
});
const bundle = result.outputFiles[0].text;

// 3) Compile the server + tools to CommonJS under dist/ for Node.
if (!arg("--browser-only")) {
  rmSync(abs("dist"), { recursive: true, force: true });
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.node.json"], {
    cwd: root,
    stdio: "inherit",
  });
}

// 4) Inline the bundle into the HTML shell.
const shell = rd("src/shell.html");
if (!shell.includes("/*BUNDLE*/"))
  throw new Error("src/shell.html is missing the /*BUNDLE*/ placeholder");
const html = shell.replace("/*BUNDLE*/", () => bundle);
writeFileSync(abs("public/index.html"), html, {
  encoding: "utf8",
  newline: "\n",
});
console.log("built public/index.html", html.length, "bytes");
