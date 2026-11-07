# Graph Report - scape-from-atlantis  (2026-11-07)

## Corpus Check
- Corpus is ~33,323 words - fits in a single context window. You may not need a graph.

## Summary
- 359 nodes · 628 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 6,200 input · 4,100 output

## Community Hubs (Navigation)
- Client UI & Sound
- Game Engine Core
- Game Rules & Setup
- Server & Build Tooling
- Package Configuration
- Server Networking
- Graphics Rendering
- TypeScript Config
- Node TS Config
- Engine Tests

## God Nodes (most connected - your core abstractions)
1. `render()` - 17 edges
2. `README (Escape from Atlantis Online)` - 17 edges
3. `apply()` - 15 edges
4. `compilerOptions` - 15 edges
5. `connect()` - 14 edges
6. `dests()` - 12 edges
7. `ov()` - 11 edges
8. `onEv()` - 11 edges
9. `onNet()` - 11 edges
10. `compilerOptions` - 11 edges

## Surprising Connections (you probably didn't know these)
- `/*BUNDLE*/ Placeholder` --references--> `esbuild + tsc Build Pipeline`  [INFERRED]
  src/shell.html → README.md
- `Bundled Game JavaScript` --references--> `src/engine.ts Game Rules Module`  [INFERRED]
  public/index.html → README.md
- `Engine Constants (CONT, W, H, SAFE, DIE...)` --references--> `src/engine.ts Game Rules Module`  [INFERRED]
  public/index.html → README.md
- `Engine Constants (CONT, W, H, SAFE, DIE...)` --references--> `Survive: Escape from Atlantis Rules`  [INFERRED]
  public/index.html → game-rule.txt
- `Room` --references--> `State`  [EXTRACTED]
  server.ts → src/engine.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four-Phase Turn Structure** — game_rule_turn_structure, game_rule_tile_play_phase, game_rule_movement_phase, game_rule_tile_removal_phase, game_rule_creature_die_phase [EXTRACTED 1.00]
- **Online Multiplayer Server-Authority Architecture** — readme_server_authority, readme_websocket_protocol, readme_hidden_info, readme_reconnect_token, readme_server_module [INFERRED 0.85]
- **Shell + Bundle Build Pipeline** — readme_build_pipeline, src_shell, src_shell_bundle_placeholder, public_index, public_index_bundle [INFERRED 0.85]

## Communities (11 total, 1 thin omitted)

### Community 0 - "Client UI & Sound"
Cohesion: 0.05
Nodes (73): Sel, ac(), isMuted(), noise(), sfx(), toggleMute(), tone(), act() (+65 more)

### Community 1 - "Game Engine Core"
Cohesion: 0.07
Nodes (59): apply(), ApplyResult, arrive(), BoardState, Boat, boatArrive(), boatAt(), canB() (+51 more)

### Community 2 - "Game Rules & Setup"
Cohesion: 0.07
Nodes (40): Survive: Escape from Atlantis Rules, Boat Rules, Game Components, Phase 4: Roll Creature Die, Defensive Tiles, Goal: Highest Sum of Saved People, Phase 2: Move People & Boats, Safe Island Arrival (+32 more)

### Community 3 - "Server & Build Tooling"
Cohesion: 0.06
Nodes (27): code(), api, choose(), rnd(), html, root, shell, tsc (+19 more)

### Community 4 - "Package Configuration"
Cohesion: 0.07
Nodes (26): dependencies, ws, description, devDependencies, esbuild, tsx, @types/node, @types/ws (+18 more)

### Community 5 - "Server Networking"
Cohesion: 0.11
Nodes (23): attach(), broadcast(), clean(), ClientMsg, conn(), Ctx, dir, handle() (+15 more)

### Community 6 - "Graphics Rendering"
Cohesion: 0.14
Nodes (22): at(), boat(), bubbles(), cardArt(), cardSvg(), creature(), dieFace(), dolphin() (+14 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+8 more)

### Community 8 - "Node TS Config"
Cohesion: 0.12
Nodes (15): ./tsconfig.json, compilerOptions, isolatedModules, module, moduleResolution, noEmit, noImplicitAny, outDir (+7 more)

### Community 9 - "Engine Tests"
Cohesion: 0.28
Nodes (5): A, Chk, eq(), q(), test()

## Knowledge Gaps
- **14 isolated node(s):** `@types/node`, `@types/ws`, `tsx`, `typescript`, `./tsconfig.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 156 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ws` connect `Package Configuration` to `Server & Build Tooling`, `Server Networking`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `render()` (e.g. with `ui.ts` and `S()`) actually correct?**
  _`render()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/ws`, `tsx` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Client UI & Sound` be split into smaller, more focused modules?**
  _Cohesion score 0.05443037974683544 - nodes in this community are weakly interconnected._
- **Why does `api` connect `Server & Build Tooling` to `Client UI & Sound`, `Game Engine Core`, `Server Networking`, `Engine Tests`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `Game Engine Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06721311475409836 - nodes in this community are weakly interconnected._
- **Why does `State` connect `Server Networking` to `Client UI & Sound`, `Game Engine Core`, `Server & Build Tooling`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._