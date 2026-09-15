# Shallot Eval Contract

This evaluation admits Bun `1.4.2` from `.bun-version`/`packageManager`. Its carrier is the installed
`shallot` bin. Run `bun run list`, `bun run check`, `bun run test`, and `bun run workflow`; these
surface gates stay independent from task setup and grading.

Eval owns the prompts, context arms, withheld task expectations, invocation records, and agent
outcomes. Shallot owns the installed carrier, scheduler and observation mechanism, browser driver,
capture contract, and tests of those mechanisms. Eval may consume those public exports. It does not
copy them, import Shallot source, archive engine paths, use a workspace link as evidence, turn task
gates into a second engine-correctness population, or infer model capability from one run.

## Package States

- Local co-development is an uncommitted `bun link` producer registration plus
  `bun link @dylanebert/shallot --no-save` here. Record both HEAD/dirt states and the consumer
  `package.json`/`bun.lock` hashes; the installed realpath must equal the producer. Exit with a fresh
  empty-cache `bun install --force --frozen-lockfile --cache-dir <cache>`, prove a non-producer
  realpath and the candidate identity, rerun the focused gate, and unlink the producer when finished.
- Source staging is the persisted dev dependency and lock resolution
  `github:dylanebert/shallot#0664218f465224397b80aeb604b51178ac71cfb2`. Both manifest and lock must
  carry the complete SHA; frozen installs use a newly empty explicit cache.
- The local pack made by `bun run setup` is **artifact preflight**, not source staging. It is produced
  from that source commit, installed only in the out-of-tree task app, and recorded in `.eval.json`
  with source commit and SHA-256 tar integrity. Generated apps retain the S1 stable
  `@dylanebert/shallot@^0.9.5` declaration outside that temporary artifact override.

No saved `link:`/`file:` source, short or moving Git ref, mutable tag, global checkout, private engine
path, or local pack presented as a staged identity is admitted. A clean exit is a forced frozen install
from an empty cache, followed by identity/realpath proof and a focused gate with no producer residue.

## Task And Frame Gates

`bun run setup <task>` creates an isolated temp app and copies only `PROMPT.md`; withheld claims and
notes remain in this repository. The selected arm provides the installed packed package and its
shipped public context. Setup records the exact source commit and artifact integrity in `.eval.json`.
`bun run grade <task> <project>` runs the project's independent check/build gates, then calls the
installed `@dylanebert/shallot/harness` `runBrowserCheck`. The temporary probe imports only the
installed public `@dylanebert/shallot/harness/capture` `captureFrame` contract. It asserts the
existing task properties semantically over `final-canvas 1280x720@1 rgba8-tight`, never by a screenshot
golden, CPU reconstruction of GPU truth, software adapter, copied capture transport, or
archived/private engine driver. A determined task failure is `FAIL`; a missing or unusable public
instrument is `INCOMPLETE`, never green. The browser seat must positively identify a real adapter; an
absent or fallback seat is inconclusive/refused, never green. Grading tears down its ephemeral app
server and leaves no tabs.

Task setup, grading, and the carrier's surface checks are separate gates. Empty changed-subject
selection refuses rather than falling through to units. Product checks do not claim that carrier
selection or task tooling proves engine correctness. An agent stall is an Eval discoverability
finding, not proof that an internal Shallot mechanism is broken.
