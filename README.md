# shallot-eval

Can a stock coding agent compose Shallot from the shipped package and complete a small user-shaped
task? Each task has a with-context arm and a without-context arm. Setup builds an isolated project, an
agent works in it, and a withheld gate grades the result through Shallot's public observation and
capture exports. This repository owns the task prompts, arms, withheld expectations, invocation
records, and outcomes. Shallot owns engine correctness and the mechanism that establishes it.

`engine.json` pins the qualified source commit used for the installed package artifact preflight. A
single run does not produce a score, aggregate, model-capability conclusion, or comparative claim.

## Surface Commands

The repository admits eight checks through the installed Shallot carrier: three hermetic result units,
three tar/filesystem setup integrations, and two package/frame contract integrations. The default
surface never runs task setup, task grading, a browser, or an engine clone.

```bash
bun install
bun run list
bun run check
bun run test
bun run test -- --integration --base <base-ref> --diff <head-ref>
```

The setup integrations are selected only when their declared subjects change in their complete token
streams. Comment-only edits do not select them. Regenerate the committed hosted workflow with
`bun run workflow`; `bun run check` refuses workflow drift.

The carrier is pinned as a dev-only dependency to Shallot source commit
`70770cfc34d82fdd19cb705d8753bb6f093748d6`. After `bun install`, these surface commands use the
installed `shallot` bin and do not clone an engine.

## The Contract

- **The agent never sees the gate.** `tasks/<task>/gate.ts` and `NOTES.md` stay here. Setup copies
  only `PROMPT.md` into the isolated project.
- **Isolation is an artifact preflight in a temp dir.** Setup packs the qualified source commit into
  a temporary tarball, records its source SHA and tar SHA-256, and installs it into a fresh
  `create-shallot` project under the OS temp dir. The agent sees only the installed
  `node_modules/@dylanebert/shallot` package and the context selected by its arm. It cannot use the
  source checkout as evidence. This local pack is not the repository's source-staged identity.
- **Gates assert positive behavior.** Each one drives the canvas, sends synthetic input where needed,
  and checks the task claim. The withheld task files remain outside the generated project.
- **Public instrumentation owns observation.** Grading runs the project's independent check/build
  gates, then uses the installed Shallot `runBrowserCheck` and `captureFrame` public contracts. Eval
  does not copy a browser driver or capture transport. A task failure is `FAIL`; missing or unusable
  public instrumentation is `INCOMPLETE`, not a pass.
- **Surface cadence is separate from task gates.** `test` runs only the three result units. The five
  integration rows run only through subject selection or an explicit carrier row selector. Task
  setup and grading remain explicit commands and are not default checks.

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
# an agent works in that dir with PROMPT.md and the installed package
bun run grade red-box <projectDir>
```

`--bare` sets up the without-context arm: the tarball loses `examples/` and `AGENTS.md`, and the
scaffold's agent docs lose their pointer to them. Run a task with and without it to observe the two
arms. `--json` prints the task, candidate source identity, runtime seat, and artifact identity.

The browser seat and fixed `final-canvas 1280x720@1 rgba8-tight` identity travel with the verdict.
Fallback or missing GPU/Chromium premises refuse rather than pass. An agent stall is a product
discoverability finding for Shallot's public API, CLI, examples, or docs, not evidence of an internal
engine defect.
