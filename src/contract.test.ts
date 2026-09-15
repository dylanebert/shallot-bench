import { expect } from "bun:test";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { CAPTURE_CONTRACT, captureFrame } from "@dylanebert/shallot/harness/capture";
import { check } from "@dylanebert/shallot/harness/check";

const ROOT = resolve(import.meta.dir, "..");
const CANDIDATE = "70770cfc34d82fdd19cb705d8753bb6f093748d6";

check(
    "installed candidate identity and public capture export",
    {
        claim: "Eval installs the qualified candidate and public frame seam",
        size: "integration",
        subject: "package.json",
    },
    () => {
        const manifest = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
            devDependencies: Record<string, string>;
        };
        const lock = readFileSync(resolve(ROOT, "bun.lock"), "utf8");
        const declared = manifest.devDependencies["@dylanebert/shallot"];
        expect(declared).toBe(`github:dylanebert/shallot#${CANDIDATE}`);
        expect(lock).toContain(declared);
        const nodeModules = realpathSync(resolve(ROOT, "node_modules"));
        const installed = realpathSync(resolve(ROOT, "node_modules/@dylanebert/shallot"));
        expect(installed.startsWith(`${nodeModules}/`)).toBe(true);
        expect(JSON.parse(readFileSync(resolve(installed, "package.json"), "utf8")).name).toBe(
            "@dylanebert/shallot",
        );
        expect(typeof captureFrame).toBe("function");
    },
);

check(
    "grade probe uses the installed final-canvas contract",
    {
        claim: "the live grade consumes the public fixed final-canvas frame contract",
        size: "integration",
        subject: "src/grade-probe.ts",
    },
    () => {
        expect(CAPTURE_CONTRACT).toEqual({
            width: 1280,
            height: 720,
            deviceScale: 1,
            surface: "final-canvas",
            encoding: "rgba8-tight",
        });
    },
);
