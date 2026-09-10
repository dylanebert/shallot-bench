# shallot-bench

Can a fresh coding agent build a game with Shallot using only what ships on npm? Each task is a small problem a user would ask for. Setup builds an isolated project, an agent works in it, and a withheld gate grades the result by driving the running app.

The number that matters is task completion with and without the context the engine ships (its `examples/` corpus and agent docs), measured per engine version. `engine.json` pins the version.

## The Contract

- **The agent never sees the gate.** `tasks/<task>/gate.ts` and `NOTES.md` stay here. Setup copies only `PROMPT.md` into the project.
- **Isolation is a tarball in a temp dir.** Setup clones the engine at the pinned tag, packs it, and installs the tarball into a fresh `create-shallot` project under the OS temp dir. The agent sees `node_modules/@dylanebert/shallot`, exactly what an npm user gets, and no engine source. This repo never reads the engine by path.
- **Gates assert positive behavior**, never just the absence of errors. Each one drives the canvas (pixels, synthetic input) and checks the task's claim holds.

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

Grading isn't available yet. Gates run through `shallot check` in the project, which the engine doesn't ship, so `grade` validates its arguments and exits 2. The gates still import the old browser driver, archived in the engine under `archive/verify`, so `tsconfig.json` leaves `tasks/` out until they're redeclared for `check`.
