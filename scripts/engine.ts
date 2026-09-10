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
    // `build` compiles the audio WASM and prepack copies in the shipped `examples/`, as a publish does.
    // The build's later native-host step needs system webview libraries a bench seat may lack; the
    // tarball ships that crate as source, so only the audio WASM is required here.
    if (!existsSync(join(checkout, "node_modules"))) run(["bun", "install"], checkout);
    const wasm = ["rust/audio/pkg", "crates/audio/pkg"]
        .map((d) => join(pkg, d, "shallot_audio.wasm"))
        .find(existsSync);
    if (!wasm) {
        Bun.spawnSync(["bun", "run", "build"], { cwd: checkout, stdout: "pipe", stderr: "pipe" });
        const built = ["rust/audio/pkg", "crates/audio/pkg"].some((d) =>
            existsSync(join(pkg, d, "shallot_audio.wasm")),
        );
        if (!built) throw new Error(`engine build at ${engineTag} produced no audio WASM`);
    }
    run(["bun", "pm", "pack", "--destination", dest], pkg);
    const tgz = readdirSync(dest).find((f) => f.endsWith(".tgz") && !f.startsWith("."));
    if (!tgz) throw new Error(`no tarball produced in ${dest}`);
    return join(dest, tgz);
}

if (import.meta.path === Bun.main) console.log(engineTarball(join(engineRoot, "pack")));
