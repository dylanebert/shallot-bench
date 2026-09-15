# shallot-bench

Can a fresh coding agent build a game with Shallot using only what ships on npm? Each task is a small problem a user would ask for. Setup builds an isolated project, an agent works in it, and a withheld gate grades the result by driving the running app.

The number that matters is task completion with and without the context the engine ships (its `examples/` corpus and agent docs), measured per engine source identity. `engine.json` pins the qualified source commit.

## Surface Commands

The repository admits eight checks through the installed Shallot carrier: three hermetic result units, three tar/filesystem setup integrations, and two package/frame contract integrations. The default surface never runs task setup, task grading, a browser, or an engine clone.

```bash
bun install
bun run list
bun run check
bun run test
bun run test -- --integration --base <base-ref> --diff <head-ref>
```

The setup integrations are selected only when their declared subjects change in their complete token streams. Comment-only edits do not select them. Regenerate the committed hosted workflow with `bun run workflow`; `bun run check` refuses workflow drift.

The carrier is pinned as a dev-only dependency to Shallot source commit `70770cfc34d82fdd19cb705d8753bb6f093748d6`. After `bun install`, these surface commands use the installed `shallot` bin and do not clone an engine.

## The Contract

- **The agent never sees the gate.** `tasks/<task>/gate.ts` and `NOTES.md` stay here. Setup copies only `PROMPT.md` into the project.
- **Isolation is an artifact preflight in a temp dir.** Setup packs the qualified source commit into a temporary tarball, records its source SHA and tar SHA-256, and installs it into a fresh `create-shallot` project under the OS temp dir. The agent sees only `node_modules/@dylanebert/shallot`, and no engine source. This local pack is not the repository's source-staged identity.
- **Gates assert positive behavior**, never just the absence of errors. Each one drives the canvas (pixels, synthetic input) and checks the task's claim holds.
- **Surface cadence is separate from task gates.** `test` runs only the three result units. The five integration rows run only through subject selection or an explicit carrier row selector. Task setup and grading remain explicit commands and are not default checks.

## Tasks

| task | problem | gate observes |
|------|---------|---------------|
| `red-box` | a static red cube on a dark background | centre is red, distinct from background, and holds still |
| `falling-box` | a box drops under gravity and lands | blue-pixel centroid moves down, then settles |
| `orbit-on-drag` | orbit the camera by dragging | idle view is stable; a drag changes it |
| `color-on-key` | spacebar turns a cube green | centre reads white before the press, green after |
| `persist-color` | number keys paint the cube; the colour survives a reload | key paints the target hue; a fresh load still reads it |
| `striped-material` | a cube with a moving procedural pattern | face brightness oscillates; two frames ~1s apart differ |

## Run One Task

```bash
bun install
bun run setup red-box          # prints the project dir on the last line
# an agent works in that dir with PROMPT.md and the installed engine
bun run grade red-box <projectDir>
```

`--bare` sets up the without-context arm: the tarball loses `examples/` and `AGENTS.md`, and the scaffold's agent docs lose their pointer to them. Run a task with and without it to get the delta. `--json` prints the task, project, candidate source identity, runtime seat and artifact identity.

Grading runs the project's independent check/build gates, then uses the installed Shallot `runBrowserCheck` and `captureFrame` public contract. The withheld task claims stay in this repository; the temporary probe is injected only for the run. The browser seat and fixed `final-canvas 1280x720@1 rgba8-tight` identity travel with the verdict, and fallback or missing GPU/Chromium premises refuse rather than pass.
