# shallot-bench

Can a fresh coding agent build a game with Shallot using only what ships on npm? Each task is a small problem a user would ask for. Setup builds an isolated project, an agent works in it, and a withheld gate grades the result by driving the running app.

The number that matters is task completion with and without the context the engine ships (its `examples/` corpus and agent docs), measured per engine version. `engine.json` pins the version.

## Surface Commands

The repository admits six checks through the installed Shallot carrier: three hermetic result units and three tar/filesystem integrations. The default surface never runs task setup, task grading, a browser, or an engine clone.

```bash
bun install
bun run list
bun run check
bun run test
bun run test:integration -- --base <base-ref> --diff <head-ref>
```

The three setup integrations are selected only when the root-law subject `src/setup.ts` changes in its complete token stream. Comment-only edits do not select them. Regenerate the committed hosted workflow with `bun run workflow`; `bun run check` refuses workflow drift.

The carrier is pinned as a dev-only dependency to Shallot commit `746ffc071fd3afeb6f29727b09e6d827c9d1d71f`. After `bun install`, these surface commands use the installed package and do not clone an engine or need network access.

## The Contract

- **The agent never sees the gate.** `tasks/<task>/gate.ts` and `NOTES.md` stay here. Setup copies only `PROMPT.md` into the project.
- **Isolation is a tarball in a temp dir.** Setup clones the engine at the pinned tag, packs it, and installs the tarball into a fresh `create-shallot` project under the OS temp dir. The agent sees `node_modules/@dylanebert/shallot`, exactly what an npm user gets, and no engine source. This repo never reads the engine by path.
- **Gates assert positive behavior**, never just the absence of errors. Each one drives the canvas (pixels, synthetic input) and checks the task's claim holds.
- **Surface cadence is separate from task gates.** `test` runs only the three result units. The three tar/filesystem rows run only through subject selection or an explicit carrier row selector. Task setup and grading remain explicit commands and are not default checks.

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

`--bare` sets up the without-context arm: the tarball loses `examples/` and `AGENTS.md`, and the scaffold's agent docs lose their pointer to them. Run a task with and without it to get the delta. `--json` prints `{ task, engine, project, work }`.

Grading drives the task's withheld gate through `shallot check`. The gates still import the old browser driver, archived in the engine under `archive/verify`; those task operations are intentionally outside the default surface.
