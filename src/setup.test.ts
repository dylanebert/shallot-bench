// S3 arm — evals/setup.ts stripTarball
//
// Invariant: the --bare arm strips AGENTS.md from the tarball (not just
// examples/). stripTarball removes it with an rmSync.
//
// stripTarball is hermetic (untar → delete → re-tar in a temp dir), so each arm builds a
// fixture tree containing package/AGENTS.md and package/examples/, tars it, runs the real exported
// function, untars the result, and asserts the stripped files are gone. No grep over source text —
// these are behavioral tests of the actual function.

import { expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "@dylanebert/shallot/harness/check";
import { stripTarball } from "./setup";

function buildFixtureTarball(): string {
    // Build a fixture tree: package/ with AGENTS.md, examples/, and a code file.
    const ex = mkdtempSync(join(tmpdir(), "shallot-setup-arm-untar-"));
    const pkg = join(ex, "package");
    mkdirSync(join(pkg, "examples"), { recursive: true });
    writeFileSync(join(pkg, "AGENTS.md"), "# Agents\n");
    writeFileSync(join(pkg, "examples", "recipe.ts"), "// recipe\n");
    writeFileSync(join(pkg, "index.ts"), "export const x = 1;\n");

    // Tar it into a .tgz at the same path stripTarball expects.
    const tgz = join(ex, "engine.tgz");
    const tar = Bun.spawnSync(["tar", "-czf", tgz, "-C", ex, "package"], { cwd: ex });
    if (tar.exitCode !== 0) throw new Error(`fixture tar failed: ${tar.stderr}`);
    return tgz;
}

function untarTo(tgz: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    const tar = Bun.spawnSync(["tar", "-xzf", tgz, "-C", dest], { cwd: dest });
    if (tar.exitCode !== 0) throw new Error(`fixture untar failed: ${tar.stderr}`);
}

check(
    "stripTarball — removes AGENTS.md from the tarball",
    {
        claim: "bare setup removes AGENTS.md from the installed tarball",
        size: "integration",
        subject: "src/setup.ts",
    },
    () => {
        const tgz = buildFixtureTarball();
        try {
            stripTarball(tgz);
            const dest = mkdtempSync(join(tmpdir(), "shallot-setup-arm-check-"));
            try {
                untarTo(tgz, dest);
                expect(existsSync(join(dest, "package/AGENTS.md"))).toBe(false);
            } finally {
                rmSync(dest, { recursive: true, force: true });
            }
        } finally {
            rmSync(tgz, { force: true });
            rmSync(join(tmpdir(), "shallot-setup-arm-untar-"), { recursive: true, force: true });
        }
    },
);

check(
    "stripTarball — removes examples/ from the tarball",
    {
        claim: "bare setup removes examples from the installed tarball",
        size: "integration",
        subject: "src/setup.ts",
    },
    () => {
        const tgz = buildFixtureTarball();
        try {
            stripTarball(tgz);
            const dest = mkdtempSync(join(tmpdir(), "shallot-setup-arm-check-"));
            try {
                untarTo(tgz, dest);
                expect(existsSync(join(dest, "package/examples"))).toBe(false);
            } finally {
                rmSync(dest, { recursive: true, force: true });
            }
        } finally {
            rmSync(tgz, { force: true });
            rmSync(join(tmpdir(), "shallot-setup-arm-untar-"), { recursive: true, force: true });
        }
    },
);

check(
    "stripTarball — preserves the code files (does not over-strip)",
    {
        claim: "bare setup preserves code files in the installed tarball",
        size: "integration",
        subject: "src/setup.ts",
    },
    () => {
        const tgz = buildFixtureTarball();
        try {
            stripTarball(tgz);
            const dest = mkdtempSync(join(tmpdir(), "shallot-setup-arm-check-"));
            try {
                untarTo(tgz, dest);
                expect(existsSync(join(dest, "package/index.ts"))).toBe(true);
                expect(readFileSync(join(dest, "package/index.ts"), "utf8").trim()).toBe(
                    "export const x = 1;",
                );
            } finally {
                rmSync(dest, { recursive: true, force: true });
            }
        } finally {
            rmSync(tgz, { force: true });
            rmSync(join(tmpdir(), "shallot-setup-arm-untar-"), { recursive: true, force: true });
        }
    },
);
