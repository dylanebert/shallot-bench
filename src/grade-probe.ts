import { type Capture, captureFrame } from "@dylanebert/shallot/harness/capture";

interface Rgb {
    r: number;
    g: number;
    b: number;
}
interface Assertion {
    name: string;
    ok: boolean;
    detail: string;
}

const assertions: Assertion[] = [];
const canvas = (): HTMLCanvasElement => {
    const element = document.querySelector("canvas");
    if (!(element instanceof HTMLCanvasElement))
        throw new Error("grade refused: project has no canvas");
    return element;
};

async function waitForCanvas(): Promise<void> {
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline) {
        const element = document.querySelector("canvas");
        if (
            element instanceof HTMLCanvasElement &&
            element.width === 1280 &&
            element.height === 720
        ) {
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("grade refused: project did not present a canvas");
}

async function shot(target = canvas()): Promise<Capture> {
    return captureFrame(target);
}

function region(frame: Capture, x0: number, y0: number, x1: number, y1: number): Rgb {
    const left = Math.floor(frame.width * x0);
    const top = Math.floor(frame.height * y0);
    const right = Math.max(left + 1, Math.floor(frame.width * x1));
    const bottom = Math.max(top + 1, Math.floor(frame.height * y1));
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
            const i = (y * frame.width + x) * 4;
            r += frame.rgba[i];
            g += frame.rgba[i + 1];
            b += frame.rgba[i + 2];
            count++;
        }
    }
    return { r: r / count, g: g / count, b: b / count };
}

function diff(a: Capture, b: Capture): number {
    if (a.width !== b.width || a.height !== b.height) return Number.POSITIVE_INFINITY;
    let total = 0;
    for (let i = 0; i < a.rgba.length; i += 4) {
        total +=
            Math.abs(a.rgba[i] - b.rgba[i]) +
            Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) +
            Math.abs(a.rgba[i + 2] - b.rgba[i + 2]);
    }
    return total / (a.width * a.height * 3);
}

function assert(name: string, ok: boolean, detail: string): void {
    assertions.push({ name, ok, detail });
}

function blue(c: Rgb): boolean {
    return c.b > 90 && c.b > c.r + 30 && c.b > c.g + 20;
}
function red(c: Rgb): boolean {
    return c.r > 90 && c.r > c.g + 40 && c.r > c.b + 40;
}
function centroidY(frame: Capture, predicate: (rgb: Rgb) => boolean): number | null {
    let sum = 0;
    let count = 0;
    for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
            const i = (y * frame.width + x) * 4;
            const rgb = { r: frame.rgba[i], g: frame.rgba[i + 1], b: frame.rgba[i + 2] };
            if (predicate(rgb)) {
                sum += y;
                count++;
            }
        }
    }
    return count === 0 ? null : sum / count / frame.height;
}

async function redBox(): Promise<void> {
    const first = await shot();
    const centre = region(first, 0.4, 0.4, 0.6, 0.6);
    const corner = region(first, 0, 0, 0.12, 0.12);
    assert(
        "centre is red",
        centre.r > 110 && centre.r > centre.g * 1.7 && centre.r > centre.b * 1.7,
        `${centre.r | 0},${centre.g | 0},${centre.b | 0}`,
    );
    assert(
        "cube stands out from a dark background",
        corner.r + corner.g + corner.b < centre.r + centre.g + centre.b - 80,
        `${corner.r | 0},${corner.g | 0},${corner.b | 0}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert(
        "scene is static, not spinning",
        diff(first, await shot()) < 6,
        "frame delta measured over 1.2s",
    );
}

async function fallingBox(): Promise<void> {
    const ys: number[] = [];
    const start = performance.now();
    while (performance.now() - start < 6_000) {
        const y = centroidY(await shot(), blue);
        if (y !== null) ys.push(y);
    }
    assert("a blue box is on screen", ys.length > 0, `${ys.length} blue samples`);
    const rest = ys.at(-1);
    const peak = Math.min(...ys);
    assert(
        "the box fell (moved down)",
        ys.length > 1 && rest !== undefined && rest - peak > 0.03,
        `descent ${rest === undefined ? "missing" : (rest - peak).toFixed(3)}`,
    );
    const tail = ys.slice(-2);
    assert(
        "the box settled (stopped falling)",
        tail.length === 2 && Math.abs(tail[1] - tail[0]) < 0.01,
        "tail centroid delta",
    );
}

async function orbitOnDrag(): Promise<void> {
    const before = await shot();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const idle = await shot();
    const box = canvas().getBoundingClientRect();
    const y = box.y + box.height / 2;
    canvas().dispatchEvent(
        new PointerEvent("pointerdown", {
            bubbles: true,
            clientX: box.x + box.width * 0.3,
            clientY: y,
            buttons: 1,
        }),
    );
    for (let i = 1; i <= 12; i++) {
        canvas().dispatchEvent(
            new PointerEvent("pointermove", {
                bubbles: true,
                clientX: box.x + box.width * (0.3 + (0.4 * i) / 12),
                clientY: y,
                buttons: 1,
            }),
        );
    }
    canvas().dispatchEvent(
        new PointerEvent("pointerup", {
            bubbles: true,
            clientX: box.x + box.width * 0.7,
            clientY: y,
        }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dragged = await shot();
    const idleDelta = diff(before, idle);
    const dragDelta = diff(idle, dragged);
    assert("view holds still without input", idleDelta < 0.5, `idle delta ${idleDelta.toFixed(2)}`);
    assert(
        "dragging orbits the camera",
        dragDelta > 1 && dragDelta > idleDelta * 3,
        `drag ${dragDelta.toFixed(2)} vs idle ${idleDelta.toFixed(2)}`,
    );
}

async function colorOnKey(): Promise<void> {
    canvas().focus();
    const before = region(await shot(), 0.4, 0.4, 0.6, 0.6);
    assert(
        "cube starts white",
        before.r > 150 && before.g > 150 && before.b > 150,
        `${before.r | 0},${before.g | 0},${before.b | 0}`,
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " ", code: "Space" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " ", code: "Space" }));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const after = region(await shot(), 0.4, 0.4, 0.6, 0.6);
    assert(
        "spacebar turns it green",
        after.g > 110 && after.g > after.r + 40 && after.g > after.b + 40,
        `${after.r | 0},${after.g | 0},${after.b | 0}`,
    );
}

async function persistColor(): Promise<void> {
    canvas().focus();
    const start = region(await shot(), 0.4, 0.4, 0.6, 0.6);
    const targetKey = blue(start) ? "Digit1" : "Digit3";
    const target = targetKey === "Digit1" ? red : blue;
    window.dispatchEvent(
        new KeyboardEvent("keydown", {
            bubbles: true,
            key: targetKey === "Digit1" ? "1" : "3",
            code: targetKey,
        }),
    );
    window.dispatchEvent(
        new KeyboardEvent("keyup", {
            bubbles: true,
            key: targetKey === "Digit1" ? "1" : "3",
            code: targetKey,
        }),
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert(
        "pressing the key paints the cube",
        target(region(await shot(), 0.4, 0.4, 0.6, 0.6)),
        targetKey,
    );
    const iframe = document.createElement("iframe");
    iframe.src = location.href;
    iframe.style.display = "none";
    document.body.append(iframe);
    await new Promise<void>((resolve, reject) => {
        iframe.addEventListener("load", () => resolve(), { once: true });
        iframe.addEventListener("error", () => reject(new Error("reload iframe failed")), {
            once: true,
        });
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const restored = iframe.contentDocument?.querySelector("canvas");
    assert(
        "the cube keeps its colour after a fresh load",
        restored instanceof HTMLCanvasElement &&
            target(region(await shot(restored), 0.4, 0.4, 0.6, 0.6)),
        targetKey,
    );
    iframe.remove();
}

function bands(values: number[]): { pp: number; crossings: number } {
    if (values.length < 2) return { pp: 0, crossings: 0 };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const pp = Math.max(...values) - Math.min(...values);
    const margin = Math.max(8, pp * 0.2);
    let crossings = 0;
    let sign = 0;
    for (const value of values) {
        const delta = value - mean;
        if (Math.abs(delta) < margin) continue;
        const next = delta > 0 ? 1 : -1;
        if (sign !== 0 && next !== sign) crossings++;
        sign = next;
    }
    return { pp, crossings };
}

function faceProfile(frame: Capture, axis: "x" | "y", background: number): number[] {
    const count = Math.ceil((0.4 * (axis === "x" ? frame.width : frame.height)) / 2);
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
        const t0 = 0.3 + (0.4 * i) / count;
        const t1 = 0.3 + (0.4 * (i + 1)) / count;
        const sample =
            axis === "x" ? region(frame, t0, 0.46, t1, 0.54) : region(frame, 0.46, t0, 0.54, t1);
        values.push((sample.r + sample.g + sample.b) / 3);
    }
    const cut = background + 25;
    let lo = 0;
    while (lo < values.length && values[lo] < cut) lo++;
    let hi = values.length - 1;
    while (hi > lo && values[hi] < cut) hi--;
    lo = Math.min(lo + 2, hi);
    hi = Math.max(hi - 2, lo);
    return values.slice(lo, hi + 1);
}

async function stripedMaterial(): Promise<void> {
    const first = await shot();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const second = await shot();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const third = await shot();
    const bg = region(first, 0, 0, 0.12, 0.12);
    const x = bands(faceProfile(first, "x", (bg.r + bg.g + bg.b) / 3));
    const y = bands(faceProfile(first, "y", (bg.r + bg.g + bg.b) / 3));
    const pp = Math.max(x.pp, y.pp);
    const crossings = Math.max(x.crossings, y.crossings);
    assert(
        "the surface shows a pattern, not a flat colour",
        pp > 30 && crossings >= 2,
        `peak-to-peak ${pp.toFixed(0)}, crossings ${crossings}`,
    );
    assert(
        "the pattern moves on its own",
        Math.max(diff(first, second), diff(second, third), diff(first, third)) > 0.5,
        "frame motion",
    );
}

async function run(): Promise<{ ok: boolean; checks: Assertion[]; capture: string }> {
    await waitForCanvas();
    const task = (globalThis as { __shallotEvalTask?: string }).__shallotEvalTask;
    if (task === "red-box") await redBox();
    else if (task === "falling-box") await fallingBox();
    else if (task === "orbit-on-drag") await orbitOnDrag();
    else if (task === "color-on-key") await colorOnKey();
    else if (task === "persist-color") await persistColor();
    else if (task === "striped-material") await stripedMaterial();
    else throw new Error(`unknown withheld task ${task}`);
    return {
        ok: assertions.every((entry) => entry.ok),
        checks: assertions,
        capture: "final-canvas 1280x720@1 rgba8-tight",
    };
}

void waitForCanvas().then(() => {
    const existing = window.__harness;
    // Only the installed public capture contract is used; Eval supplies no replacement transport.
    window.__harness = {
        ready: true,
        run,
        ...(existing?.read === undefined ? {} : { read: existing.read }),
    };
});
