// Set up one task's project: pack the engine at the pinned tag, scaffold a fresh project with
// `create-shallot` at its published version, install the packed tarball, and drop the task's PROMPT.md
// in. The project lands in an out-of-tree temp dir so the agent that works there sees only what ships
// on npm (`node_modules/@dylanebert/shallot`) and cannot read the engine source. The withheld gate
// stays in this repo; it is never copied into the project. Prints the project dir on the last line.
//
// `--bare` sets up the without-context arm of the shipped-context delta: the shipped `examples/` corpus
// and AGENTS.md are removed from the tarball and the scaffold's agent docs lose the section pointing at
// them. The agent keeps the code, its JSDoc and the product workflow (build/run).
//
// Run: `bun run setup <task> [--json] [--bare]`

import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { engineTag, engineTarball, root } from "../scripts/engine";

/** create-shallot's published version; the scaffold a real user gets from `bunx create-shallot` */
const CREATE_SHALLOT = "create-shallot@0.9.5";

function run(cmd: string[], cwd: string): { ok: boolean; out: string } {
    const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    return { ok: p.exitCode === 0, out: `${p.stdout.toString()}\n${p.stderr.toString()}` };
}

// Strip the shipped context out of the packed tarball itself (pack lays every file under `package/`).
// Deleting it only from `node_modules` doesn't hold: `bun add` re-resolves the `file:` dep and
// re-extracts the tarball. Untar, delete, re-tar in place at the same path.
export function stripTarball(tgz: string): void {
    const ex = mkdtempSync(join(tmpdir(), "shallot-bench-untar-"));
    const out = run(["tar", "-xzf", tgz, "-C", ex], ex);
    if (!out.ok) throw new Error(`untar ${tgz} failed:\n${out.out}`);
    rmSync(join(ex, "package/examples"), { recursive: true, force: true });
    // AGENTS.md is an agent doc, not code/JSDoc/product workflow; keeping it weakens the bare claim.
    rmSync(join(ex, "package/AGENTS.md"), { force: true });
    const re = run(["tar", "-czf", tgz, "-C", ex, "package"], ex);
    if (!re.ok) throw new Error(`re-tar ${tgz} failed:\n${re.out}`);
    rmSync(ex, { recursive: true, force: true });
}

// Strip the "## Engine reference" section from the scaffold's agent docs. Its only content is the
// pointers at the shipped AGENTS.md and `examples/`, the context the bare arm withholds. The end
// anchors on the next section or end-of-string so a last-section "Engine reference" still strips.
function stripShippedContext(md: string): string {
    return md.replace(/\n## Engine reference\n[\s\S]*?(?=\n## |$)/, "");
}

function main(): void {
    const args = process.argv.slice(2);
    const asJson = args.includes("--json");
    const bare = args.includes("--bare");
    const task = args.find((a) => !a.startsWith("--"));
    if (!task) {
        console.error("Usage: bun run setup <task> [--json] [--bare]");
        process.exit(1);
    }

    const promptPath = resolve(root, "tasks", task, "PROMPT.md");
    try {
        readFileSync(promptPath);
    } catch {
        console.error(`no such task: ${task} (missing ${promptPath})`);
        process.exit(1);
    }

    // realpath: macOS tmpdir is a symlink; vite's fs.allow prefix check needs the resolved form
    const work = realpathSync(mkdtempSync(join(tmpdir(), `shallot-bench-${task}-`)));
    const proj = join(work, "app");

    const engineTgz = engineTarball(join(work, "engine-pack"));
    if (bare) stripTarball(engineTgz);

    const scaffold = run(["bunx", CREATE_SHALLOT, "app"], work);
    if (!scaffold.ok) throw new Error(`create-shallot failed:\n${scaffold.out}`);

    // a real user installs the published engine; the packed tarball stands in for it
    const pkg = JSON.parse(readFileSync(join(proj, "package.json"), "utf8"));
    pkg.dependencies["@dylanebert/shallot"] = `file:${engineTgz}`;
    writeFileSync(join(proj, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

    const install = run(["bun", "install"], proj);
    if (!install.ok) throw new Error(`bun install failed:\n${install.out.slice(-800)}`);

    if (bare) {
        // CLAUDE.md only imports AGENTS.md, so stripping the one covers both
        const doc = join(proj, "AGENTS.md");
        writeFileSync(doc, stripShippedContext(readFileSync(doc, "utf8")));
    }

    writeFileSync(join(proj, "PROMPT.md"), readFileSync(promptPath));
    writeFileSync(
        join(proj, ".bench.json"),
        `${JSON.stringify({ task, bare, engine: engineTag, created: new Date().toISOString() }, null, 2)}\n`,
    );

    if (asJson) {
        console.log(JSON.stringify({ task, engine: engineTag, project: proj, work }));
    } else {
        console.error(`task ${task}: project ready. Agent works with cwd = the path below.`);
        console.log(proj);
    }
}

// Run only when executed directly; the test imports stripTarball.
if (import.meta.path === Bun.main) main();
