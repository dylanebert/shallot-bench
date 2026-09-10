import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

// Clones dylanebert/shallot at the tag `engine.json` pins into the ignored `.engine/`, packs it,
// and returns the tarball path. The bench reaches the engine only through this tarball, the way an
// npm user does; nothing here reads the engine by relative path.
// Precedent: shallot-site's `scripts/engine-checkout.ts`.
//
// Run: `bun run scripts/engine.ts` prints the tarball path.

const REPO = "https://github.com/dylanebert/shallot";

/** the bench repo root */
export const root = resolve(import.meta.dir, "..");

/** the engine checkout, one directory per tag */
export const engineRoot = resolve(root, ".engine");

/** the engine tag `engine.json` pins */
export const engineTag: string = (
    JSON.parse(readFileSync(resolve(root, "engine.json"), "utf8")) as { tag: string }
).tag;

function run(cmd: string[], cwd: string): void {
    const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    if (p.exitCode !== 0) {
        throw new Error(`${cmd.join(" ")} failed:\n${p.stdout.toString()}${p.stderr.toString()}`);
    }
}

/** the engine package inside the checkout: the repo root, or `packages/shallot` before the hoist */
function enginePackage(checkout: string): string {
    const nested = resolve(checkout, "packages/shallot");
    return existsSync(resolve(nested, "package.json")) ? nested : checkout;
}

/** Clone the pinned tag (once per tag), pack it into `dest`, and return the tarball path. */
export function engineTarball(dest: string): string {
    const checkout = join(engineRoot, engineTag);
    if (!existsSync(join(checkout, ".git"))) {
        rmSync(checkout, { recursive: true, force: true });
        mkdirSync(engineRoot, { recursive: true });
        run(
            ["git", "clone", "--quiet", "--depth", "1", "--branch", engineTag, REPO, checkout],
            root,
        );
    }
    const pkg = enginePackage(checkout);
    mkdirSync(dest, { recursive: true });
    run(["bun", "pm", "pack", "--ignore-scripts", "--destination", dest], pkg);
    const tgz = readdirSync(dest).find((f) => f.endsWith(".tgz") && !f.startsWith("."));
    if (!tgz) throw new Error(`no tarball produced in ${dest}`);
    return join(dest, tgz);
}

if (import.meta.path === Bun.main) console.log(engineTarball(join(engineRoot, "pack")));
