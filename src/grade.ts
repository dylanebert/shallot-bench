// Grade one task through the installed package's public browser harness. The withheld probe is bundled
// for one run and reaches the browser only through the public runBrowserCheck and captureFrame
// contracts. It does not copy a driver, capture transport, engine source, gate, or notes.

import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBrowserCheck } from "@dylanebert/shallot/harness";
import { deriveResultKind } from "./result";

const ROOT = resolve(import.meta.dir, "..");
const TASKS = new Set([
    "red-box",
    "falling-box",
    "orbit-on-drag",
    "color-on-key",
    "persist-color",
    "striped-material",
]);

type CommandResult = { command: string[]; ok: boolean; output: string };
type BrowserGrade = {
    ok: boolean;
    runtime?: unknown;
    hardware?: unknown;
    reproduction?: { capture?: string };
    checks?: unknown[];
};

type EvalRecord = {
    task?: string;
    artifact?: { kind?: string; sourceCommit?: string; sha256?: string };
};

function run(command: string[], cwd: string): CommandResult {
    const process = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
    return {
        command,
        ok: process.exitCode === 0,
        output: `${process.stdout.toString()}\n${process.stderr.toString()}`.trim(),
    };
}

function fail(message: string, output = ""): never {
    console.error(`${message}${output ? `\n${output.slice(-4_000)}` : ""}`);
    process.exit(1);
}

function expectedSource(): string {
    const engine = JSON.parse(readFileSync(join(ROOT, "engine.json"), "utf8")) as {
        source?: unknown;
    };
    if (typeof engine.source !== "string") throw new Error("engine.json has no source identity");
    const commit = engine.source.split("#").at(-1);
    if (!commit) throw new Error("engine.json source has no commit identity");
    return commit;
}

/**
 * Check the setup artifact boundary using filesystem and package metadata, not a source scan.
 * A grade may consume only a generated project with an installed packed Shallot package and the
 * matching immutable artifact record. Missing premises are unavailable instrumentation.
 */
export function validateEvalProject(project: string, task: string): void {
    const recordPath = join(project, ".eval.json");
    const packagePath = join(project, "package.json");
    const installedPath = join(project, "node_modules/@dylanebert/shallot");
    if (!existsSync(recordPath)) throw new Error("setup record .eval.json is missing");
    if (!existsSync(packagePath)) throw new Error("project package.json is missing");

    let record: EvalRecord;
    try {
        record = JSON.parse(readFileSync(recordPath, "utf8")) as EvalRecord;
    } catch (error) {
        throw new Error(`setup record is not valid JSON: ${String(error)}`);
    }
    if (record.task !== task) throw new Error(`setup record task is not ${task}`);
    if (record.artifact?.kind !== "local-pack-preflight")
        throw new Error("setup record has no local package artifact identity");
    if (record.artifact.sourceCommit !== expectedSource())
        throw new Error("setup record source identity does not match engine.json");
    if (!/^[0-9a-f]{64}$/.test(record.artifact.sha256 ?? ""))
        throw new Error("setup record has no SHA-256 package integrity");

    const projectRoot = realpathSync(project);
    const nodeModules = realpathSync(join(projectRoot, "node_modules"));
    const installed = realpathSync(installedPath);
    if (!installed.startsWith(`${nodeModules}/`))
        throw new Error("installed Shallot package resolves outside the generated project");
    const installedManifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as {
        name?: unknown;
    };
    if (installedManifest.name !== "@dylanebert/shallot")
        throw new Error("installed package is not the public Shallot package");

    const projectManifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
        dependencies?: Record<string, unknown>;
    };
    const dependency = projectManifest.dependencies?.["@dylanebert/shallot"];
    if (typeof dependency !== "string" || !dependency.startsWith("file:"))
        throw new Error("project is not using the recorded packed package artifact");
}

function printResult(result: Record<string, unknown>, kind: string, json: boolean): void {
    if (json) console.log(JSON.stringify(result));
    else {
        const hardware = result.hardware ? ` on ${String(result.hardware)}` : "";
        const capture =
            typeof result.reproduction === "object" && result.reproduction !== null
                ? ` (${String((result.reproduction as { capture?: unknown }).capture ?? "no capture")})`
                : "";
        console.log(`${kind}${hardware}${capture}`);
    }
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const positional = args.filter(
    (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--port",
);
const [task, projectArg] = positional;
const portIndex = args.indexOf("--port");
if (!task || !projectArg || !TASKS.has(task) || (portIndex !== -1 && !args[portIndex + 1]))
    fail("Usage: bun run grade <task> <projectDir> [--json] [--port <n>]");

const project = resolve(projectArg);
if (!existsSync(join(project, "package.json"))) fail(`no project at ${project}`);

let validationError: string | undefined;
try {
    validateEvalProject(project, task);
} catch (error) {
    validationError = error instanceof Error ? error.message : String(error);
}
if (validationError) {
    printResult(
        {
            task,
            project,
            result: "INCOMPLETE",
            error: validationError,
            diagnostics: "the generated project or installed public package is unavailable",
        },
        "INCOMPLETE",
        json,
    );
    process.exitCode = 2;
} else {
    const commandResults = [
        run(["bun", "run", "check"], project),
        run(["bun", "run", "build"], project),
    ];
    const typecheckOk = commandResults[0].ok;
    const buildOk = commandResults[1].ok;
    let gateOk: boolean | null = null;
    let browser: BrowserGrade | undefined;
    let instrumentationError: string | undefined;
    let failureDiagnostics: unknown;
    const probePath = join(project, ".shallot-eval-grade-probe.ts");
    const bundleDir = join(project, ".shallot-eval-grade");
    const bundlePath = join(bundleDir, "probe.js");

    if (typecheckOk && buildOk) {
        mkdirSync(bundleDir, { recursive: true });
        writeFileSync(probePath, readFileSync(join(ROOT, "src/grade-probe.ts")));
        try {
            const built = await Bun.build({
                entrypoints: [probePath],
                outdir: bundleDir,
                naming: "probe.js",
                target: "browser",
            });
            if (!built.success) throw new Error(built.logs.map(String).join("\n"));
            browser = (await runBrowserCheck((port) => [
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
            ])) as BrowserGrade;
            gateOk = browser.ok;
        } catch (error) {
            const value = error as {
                message?: string;
                runtime?: unknown;
                hardware?: unknown;
                reproduction?: BrowserGrade["reproduction"];
                diagnostics?: unknown;
            };
            if (value.message === "the page returned a failing verdict") {
                // The public instrument ran and the task made a determined negative claim.
                gateOk = false;
                browser = {
                    ok: false,
                    runtime: value.runtime,
                    hardware: value.hardware,
                    reproduction: value.reproduction,
                    checks:
                        typeof value.diagnostics === "object" && value.diagnostics !== null
                            ? (value.diagnostics as { checks?: unknown[] }).checks
                            : [],
                };
                failureDiagnostics = value.diagnostics;
            } else {
                // Driver, seat, capture, or probe failures did not determine the task outcome.
                instrumentationError = value.message ?? String(error);
            }
        } finally {
            rmSync(probePath, { force: true });
            rmSync(bundleDir, { recursive: true, force: true });
        }
    }

    const kind = deriveResultKind(typecheckOk, buildOk, gateOk);
    const result: Record<string, unknown> = {
        task,
        project,
        result: kind,
        commands: commandResults,
        runtime: browser?.runtime,
        hardware: browser?.hardware,
        reproduction: browser?.reproduction,
        checks: browser?.checks ?? [],
        ...(instrumentationError ? { diagnostics: instrumentationError } : {}),
        ...(failureDiagnostics ? { failureDiagnostics } : {}),
    };
    printResult(result, kind, json);
    if (kind === "INCOMPLETE") process.exitCode = 2;
}
