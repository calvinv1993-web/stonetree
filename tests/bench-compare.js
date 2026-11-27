// Runs of the performance test (js/bench.js) side by side: the baseline's runs and a later change's, as JSON files
// (from tests/bench.js, or copied out of the game on a phone). Each side may be several runs: each measure is then
// their middle value (the median), as one run alone varies (on a shared computer a run's work can differ by a quarter
// from the next). Per part of the route and in all: the frames a second, the work in a frame, the stalls, the ground
// made and the pictures kept, and the change. A change counts as worse only past both a share and an amount (a
// tenth of a millisecond more is noise, however many per cent it is); then it's marked and the script ends with code 1.
//   node tests/bench-compare.js <baseline.json> [more baseline runs...] -- <run.json> [more runs...]
//   node tests/bench-compare.js <baseline.json> <run.json>
const fs = require('fs');
const args = process.argv.slice(2), cut = args.indexOf('--');
const [left, right] = cut < 0 ? [[args[0]], [args[1]]] : [args.slice(0, cut), args.slice(cut + 1)];
if (!left[0] || !right[0]) { console.error('usage: node tests/bench-compare.js <baseline.json>... -- <run.json>...'); process.exit(2); }
const read = files => files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const A = read(left), B = read(right), a0 = A[0], b0 = B[0];
const median = list => { const s = list.filter(v => typeof v === 'number').sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
const of = (runs, f) => median(runs.map(r => { try { return f(r); } catch (e) { return null; } }));
if (A.concat(B).some(r => r.version !== a0.version)) console.log('(warning: the test itself differs between these runs)');
for (const k of ['canvas', 'sharp', 'quality', 'fpsSetting', 'standalone']) if (a0.device[k] !== b0.device[k]) console.log(`(warning: ${k} differs: ${a0.device[k]} and ${b0.device[k]} - not a fair comparison)`);
// worse: past the share AND the amount. (An iPhone's clock gives whole milliseconds: 1 ms more is its resolution, not
// worse. The frames a second count only where you walk: standing still the game draws 30 on purpose while nothing
// moves near you, 60 when something does, so there they say what was going on, not how fast it ran.)
const LIMITS = {
  fps: { share: 0.05, amount: 2, lowerBetter: false }, fpsInfo: { share: Infinity, amount: Infinity, lowerBetter: false },
  work50: { share: 0.10, amount: 1 }, work95: { share: 0.15, amount: 2 },
  chunkMs: { share: 0.15, amount: 40 }, memory: { share: 0.10, amount: 10 }, stalls: { share: 0.5, amount: 5 },
};
let worse = 0;
const cell = (x, y, limit) => {
  if (x === null || y === null) return '        -';
  const d = y - x, share = x ? d / x : 0, lowerBetter = limit.lowerBetter !== false;
  const bad = lowerBetter ? d > limit.amount && share > limit.share : -d > limit.amount && -share > limit.share; // (amount: more than it, so 1 ms more on a 1 ms clock is never worse)
  if (bad) worse++;
  return `${String(x).padStart(7)} -> ${String(y).padEnd(7)} ${(share > 0 ? '+' : '') + Math.round(share * 100)}%${bad ? '  WORSE' : ''}`;
};
console.log(`baseline: ${A.length} run(s) of ${a0.page} (${a0.device.canvas}, ${a0.runner ? a0.runner.emulated : a0.device.userAgent})`);
console.log(`compared: ${B.length} run(s) of ${b0.page}\n`);
const line = (label, f, limit) => console.log(`  ${label.padEnd(12)}${cell(of(A, f), of(B, f), limit)}`);
console.log('in all');
line('fps', r => r.summary.fps, LIMITS.fpsInfo);
line('work p50 ms', r => r.summary.workP50, LIMITS.work50);
line('work p95 ms', r => r.summary.workP95, LIMITS.work95);
line('stalls', r => r.summary.stalls, LIMITS.stalls);
line('chunk ms', r => r.summary.chunkMs, LIMITS.chunkMs);
line('pictures MB', r => r.summary.picturesMB, LIMITS.memory);
for (const leg of b0.legs) {
  const L = r => r.legs.find(l => l.name === leg.name);
  console.log(leg.name);
  line('fps', r => L(r).fps, /walk/.test(leg.name) ? LIMITS.fps : LIMITS.fpsInfo);
  line('work p50 ms', r => L(r).workMs.p50, LIMITS.work50);
  line('work p95 ms', r => L(r).workMs.p95, LIMITS.work95);
  line('stalls', r => L(r).stalls, LIMITS.stalls);
  line('pictures MB', r => L(r).memory.picturesMB, LIMITS.memory);
}
console.log(worse ? `\n${worse} measure(s) worse past the limits` : '\nnothing worse past the limits');
process.exit(worse ? 1 : 0);
