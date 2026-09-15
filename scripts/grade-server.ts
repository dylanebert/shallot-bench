#!/usr/bin/env bun
// Ephemeral grade transport. It proxies the candidate project only for one public Shallot harness run,
// injects the withheld probe, and tears the project server down with the process. It is not a browser
// driver and owns no frame or seat semantics; those stay in @dylanebert/shallot/harness.

import { readFileSync } from "node:fs";

const args = Bun.argv.slice(2);
function value(name: string): string {
    const index = args.indexOf(name);
    const result = index === -1 ? undefined : args[index + 1];
    if (!result) throw new Error(`grade server requires ${name}`);
    return result;
}

const port = Number(value("--port"));
const project = value("--project");
const task = value("--task");
const bundle = value("--probe");
if (!Number.isInteger(port) || port <= 0) throw new Error("grade server requires a valid --port");

const innerPort = 30_000 + Math.floor(Math.random() * 10_000);
const app = Bun.spawn(["bun", "x", "shallot", "dev", "--port", String(innerPort), "--no-open"], {
    cwd: project,
    stdout: "pipe",
    stderr: "pipe",
});

async function processOutput(): Promise<string> {
    const read = async (stream: unknown): Promise<string> =>
        stream === null || stream === undefined
            ? ""
            : await new Response(stream as ReadableStream<Uint8Array>).text();
    return [await read(app.stdout), await read(app.stderr)].filter(Boolean).join("\n").trim();
}

async function waitForApp(): Promise<void> {
    const deadline = performance.now() + 20_000;
    while (performance.now() < deadline) {
        if (app.exitCode !== null) {
            const output = await processOutput();
            throw new Error(
                `project dev command exited with ${app.exitCode}${output ? `: ${output}` : ""}`,
            );
        }
        try {
            const response = await fetch(`http://localhost:${innerPort}/`);
            if (response.ok) return;
        } catch {
            // The app is still starting.
        }
        await Bun.sleep(50);
    }
    app.kill();
    await app.exited.catch(() => undefined);
    const output = await processOutput();
    throw new Error(`timed out waiting for the candidate project${output ? `: ${output}` : ""}`);
}

await waitForApp();
const probe = readFileSync(bundle);
const server = Bun.serve({
    port,
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/__shallot_bench_probe.js") {
            return new Response(probe, {
                headers: {
                    "content-type": "text/javascript; charset=utf-8",
                    "cache-control": "no-store",
                },
            });
        }
        const upstream = await fetch(`http://localhost:${innerPort}${url.pathname}${url.search}`, {
            method: request.method,
            headers: request.headers,
        });
        if (!upstream.headers.get("content-type")?.includes("text/html")) return upstream;
        const html = await upstream.text();
        const injection =
            "<script>globalThis.__shallotBenchTask = " +
            JSON.stringify(task) +
            '</script><script type="module" src="/__shallot_bench_probe.js"></script>';
        return new Response(html.replace("</body>", `${injection}</body>`), {
            status: upstream.status,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
    },
});
console.log(`shallot bench grade server listening on ${server.port}`);

async function stop(): Promise<void> {
    server.stop(true);
    app.kill();
    await app.exited.catch(() => undefined);
}
process.once("SIGTERM", () => void stop().finally(() => process.exit(0)));
process.once("SIGINT", () => void stop().finally(() => process.exit(130)));
