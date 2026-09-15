import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Source staging and grading artifact preflight are deliberately different states. Eval's persisted
// carrier is the full-SHA Git identity in package.json/bun.lock. A setup run may pack that exact source
// into a temporary directory so the generated app sees only installed package bytes; that tarball is
// an artifact preflight, never Eval's staged dependency.
const REPO = "https://github.com/dylanebert/shallot";
export const engineSourceCommit = "0664218f465224397b80aeb604b51178ac71cfb2";

/** the Eval repository root */
export const root = resolve(import.meta.dir, "..");

/** the temporary source checkout used only to produce the grading artifact */
export const engineRoot = join(tmpdir(), "shallot-eval-engine");

const source = JSON.parse(readFileSync(resolve(root, "engine.json"), "utf8")) as {
    source?: string;
};
if (source.source !== `github:dylanebert/shallot#${engineSourceCommit}`) {
    throw new Error(
        `engine.json must name the qualified source candidate github:dylanebert/shallot#${engineSourceCommit}`,
    );
}

function run(cmd: string[], cwd: string): void {
    const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    if (p.exitCode !== 0) {
        throw new Error(`${cmd.join(" ")} failed:\n${p.stdout.toString()}${p.stderr.toString()}`);
    }
}

/** the engine package inside the checkout: the repo root, or packages/shallot before the hoist */
function enginePackage(checkout: string): string {
    const nested = resolve(checkout, "packages/shallot");
    return existsSync(resolve(nested, "package.json")) ? nested : checkout;
}

function sha256(path: string): string {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Pack the exact qualified source for grading isolation and return its artifact identity. */
export function engineArtifact(dest: string): {
    path: string;
    sourceCommit: string;
    sha256: string;
} {
    const checkout = join(engineRoot, engineSourceCommit);
    if (!existsSync(join(checkout, ".git"))) {
        rmSync(checkout, { recursive: true, force: true });
        mkdirSync(engineRoot, { recursive: true });
        run(["git", "clone", "--quiet", REPO, checkout], root);
    }
    run(["git", "checkout", "--quiet", engineSourceCommit], checkout);
    const pkg = enginePackage(checkout);
    mkdirSync(dest, { recursive: true });
    // A packed artifact is the isolation boundary for the generated app. Build/prepack may produce
    // shipped bytes, but the identity remains the source commit recorded above.
    if (!existsSync(join(checkout, "node_modules")))
        run(["bun", "install", "--frozen-lockfile"], checkout);
    const wasm = ["rust/audio/pkg", "crates/audio/pkg"]
        .map((d) => join(pkg, d, "shallot_audio.wasm"))
        .find(existsSync);
    if (!wasm) {
        const build = Bun.spawnSync(["bun", "run", "build"], {
            cwd: checkout,
            stdout: "pipe",
            stderr: "pipe",
        });
        if (build.exitCode !== 0) {
            throw new Error(
                `engine build at ${engineSourceCommit} failed:\n${build.stderr.toString()}`,
            );
        }
    }
    run(["bun", "pm", "pack", "--destination", dest, "--quiet"], pkg);
    const tgz = readdirSync(dest).find((file) => file.endsWith(".tgz") && !file.startsWith("."));
    if (!tgz) throw new Error(`no Shallot artifact produced in ${dest}`);
    const path = join(dest, tgz);
    return { path, sourceCommit: engineSourceCommit, sha256: sha256(path) };
}

/** Compatibility name for the setup entrypoint; callers still receive the full artifact identity. */
export function engineTarball(dest: string): string {
    return engineArtifact(dest).path;
}

if (import.meta.path === Bun.main)
    console.log(JSON.stringify(engineArtifact(join(engineRoot, "pack"))));
