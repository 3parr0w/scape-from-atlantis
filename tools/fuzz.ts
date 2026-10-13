// 300 random full games against the engine: must always finish, never error, never leak tile contents in a view.
import A from "../src/engine.js";
import { choose } from "./bot.js";

let ended = 0,
  steps = 0;
for (let g = 1; g <= 300; g++) {
  let S = A.newGame(2 + (g % 3), g),
    n = 0;
  while (!S.over && n++ < 4000) {
    const pl = S.pending ? S.pending.queue[0]! : S.cur;
    const r = A.apply(S, pl, choose(S, pl));
    if ("error" in r) {
      console.log("ERR game", g, S.phase, r.error);
      process.exit(1);
    }
    S = r.state;
    steps++;
    if (JSON.stringify(A.view(S, 0)).includes('"cont"')) {
      console.log("LEAK");
      process.exit(1);
    }
  }
  if (S.over) ended++;
}
console.log("fuzz: games ended", ended, "/300, actions", steps);
process.exit(ended === 300 ? 0 : 1);
