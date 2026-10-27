/**
 * Checks the built engine: public/engine.wasm must be at most 60 KB gzipped, and a scripted
 * run in WebAssembly must draw exactly the same frame as the native Go build.
 * Needs Go on PATH (for the native reference) and a built engine (`pnpm engine`).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT = 60 * 1024;
const wasm = readFileSync('public/engine.wasm');
const gz = gzipSync(wasm, { level: 9 }).length;
console.log(`engine.wasm: ${wasm.length} B, ${gz} B gzipped (limit ${LIMIT})`);
if (gz > LIMIT) {
  console.error('engine.wasm is over the 60 KB gzipped budget');
  process.exit(1);
}

type Exports = {
  memory: WebAssembly.Memory;
  _initialize(): void;
  init(seed: number, preset: number): void;
  ghost(on: number): void;
  kick(body: number, dvx: number, dvy: number): void;
  age(): number;
  advance(ms: number): void;
  render(): void;
  framePtr(): number;
  frameWidth(): number;
  frameHeight(): number;
};

const { instance } = await WebAssembly.instantiate(wasm, {});
const e = instance.exports as unknown as Exports;
e._initialize();
// The same script as run() in engine/sim/sim_test.go.
e.init(318, 4);
e.ghost(1);
const start = performance.now();
for (let i = 0; i < 600; i++) {
  if (i === 30) e.kick(-1, 0, 0);
  if (i === 60) e.age();
  e.advance(1000 / 60);
  e.render();
}
const perFrame = (performance.now() - start) / 600;
const frame = new Uint8Array(e.memory.buffer, e.framePtr(), e.frameWidth() * e.frameHeight());
const wasmHash = createHash('sha256').update(frame).digest('hex');

const native = execFileSync('go', ['test', './sim/', '-run', 'PrintReferenceHash', '-v'], {
  cwd: 'engine',
  env: { ...process.env, ENGINE_HASH: '1' },
  encoding: 'utf8',
});
const nativeHash = /native ([0-9a-f]{64})/.exec(native)?.[1];
console.log(`frame digest: wasm ${wasmHash}, native ${nativeHash}`);
console.log(`advance + render: ${perFrame.toFixed(3)} ms per frame in Node`);
if (wasmHash !== nativeHash) {
  console.error('WebAssembly and native builds drew different frames');
  process.exit(1);
}
