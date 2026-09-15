// Grade one task through the installed candidate's public browser harness. The task probe is bundled from
// the target project's installed package into a temporary file; it is injected only for this run. The
// withheld claims never enter the generated project, and capture/seat/diagnostic semantics belong to the
// package's runBrowserCheck + captureFrame contract.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBrowserCheck } from "@dylanebert/shallot/harness";

const ROOT = resolve(import.meta.dir, "..");
const TASKS = new Set([
    "red-box",
    "falling-box",
    "orbit-on-drag",
    "color-on-key",
    "persist-color",
    "striped-material",
]);

type CommandResult = { ok: boolean; output: string };
function run(command: string[], cwd: string): CommandResult {
    const process = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
    return {
        ok: process.exitCode === 0,
        output: `${process.stdout.toString()}\n${process.stderr.toString()}`.trim(),
    };
}
function fail(message: string, output = ""): never {
    console.error(`${message}${output ? `\n${output.slice(-4_000)}` : ""}`);
    process.exit(1);
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const positional = args.filter(
    (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--port",
);
const [task, projectArg] = positional;
const portIndex = args.indexOf("--port");
if (!task || !projectArg || !TASKS.has(task) || (portIndex !== -1 && !args[portIndex + 1])) {
    fail("Usage: bun run grade <task> <projectDir> [--json] [--port <n>]");
}
const project = resolve(projectArg);
if (!existsSync(join(project, "package.json"))) fail(`no project at ${project}`);

const checks = [
    ["bun", "run", "check"],
    ["bun", "run", "build"],
] as const;
for (const command of checks) {
    const result = run([...command], project);
    if (!result.ok) fail(`${command.join(" ")} failed`, result.output);
}

const probePath = join(project, ".shallot-bench-grade-probe.ts");
const bundleDir = join(project, ".shallot-bench-grade");
const bundlePath = join(bundleDir, "probe.js");
mkdirSync(bundleDir, { recursive: true });
writeFileSync(probePath, readFileSync(join(ROOT, "src/grade-probe.ts")));
try {
    const built = await Bun.build({
        entrypoints: [probePath],
        outdir: bundleDir,
        naming: "probe.js",
        target: "browser",
    });
    if (!built.success) fail("grade probe bundle failed", built.logs.map(String).join("\n"));
    const grade = await runBrowserCheck((port) => [
        process.execPath,
        join(ROOT, "scripts/grade-server.ts"),
        "--project",
        project,
        "--task",
        task,
        "--probe",
        bundlePath,
        "--port",
        String(port),
    ]);
    const result = {
        task,
        project,
        result: grade.ok ? "PASS" : "FAIL",
        runtime: grade.runtime,
        hardware: grade.hardware,
        reproduction: grade.reproduction,
        checks: grade.checks ?? [],
    };
    if (json) console.log(JSON.stringify(result));
    else
        console.log(
            `${result.result} ${task} on ${grade.hardware} (${grade.reproduction.capture})`,
        );
} catch (error) {
    const value = error as { message?: string; reproduction?: unknown; diagnostics?: unknown };
    const result = {
        task,
        project,
        result: "INCOMPLETE",
        error: value.message ?? String(error),
        reproduction: value.reproduction,
        diagnostics: value.diagnostics,
    };
    if (json) console.log(JSON.stringify(result));
    else console.error(JSON.stringify(result));
    process.exitCode = 2;
} finally {
    rmSync(probePath, { force: true });
    rmSync(bundleDir, { recursive: true, force: true });
}
