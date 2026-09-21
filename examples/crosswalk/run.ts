import { checkConformance, explore } from '../../src/index.js';
import { CarLightController } from './00a-naive-lights.js';
import { CrosswalkController } from './00b-naive-crosswalk.js';
import { spec as buggySpec } from './01-spec.js';
import { implementation as naiveImpl } from './01b-naive-conformance.js';
import { spec as fixedSpec } from './02-spec-fixed.js';
import { implementation as buggyImpl } from './03-implementation.js';
import { implementation as fixedImpl } from './04-implementation-fixed.js';

console.log('Step 0a: a plain car-light controller, already in production');
const lights = new CarLightController();
lights.start(20);
await new Promise((resolve) => {
  setTimeout(resolve, 70); // let a few ticks pass
});
lights.stop();
console.log(`  after a few ticks: carLight=${lights.carLight}`);
console.log('  no pedestrian yet, so there is no invariant to check');

console.log('\nStep 0b: adding a pedestrian button to it');
const naive = new CrosswalkController();
naive.start(20);
naive.pressButton(); // pressed immediately, while the light is still green - the timer hasn't ticked yet
await new Promise((resolve) => {
  setTimeout(resolve, 30); // let its own internal timer fire once
});
naive.stop();
console.log(`  after one tick of its own timer: carLight=${naive.carLight}, walkSignal=${naive.walkSignal}`);
console.log(
  naive.carLight === 'red' ? '  ok' : `  BUG: walk signal is on while the car light is still ${naive.carLight}`,
);

console.log('\nStep 1: the spec, as first written');
const step1 = explore(buggySpec);
const [violation] = step1.invariants;
console.log(`  visited ${step1.visitedCount} states`);
if (violation !== undefined && !violation.holds) {
  console.log(`  VIOLATED: ${violation.name}`);
  console.log(`  trace: ${violation.counterexample?.join(' -> ') ?? ''}`);
}

console.log('\nStep 1b: checking the real, shipped implementation against that same buggy spec');
const step1b = checkConformance(buggySpec, naiveImpl);
console.log(
  step1b.mismatch === undefined
    ? `  conforms on all ${String(step1b.visitedCount)} reachable states - the real code has the same bug`
    : '  mismatched',
);

console.log('\nStep 2: the fixed spec');
const step2 = explore(fixedSpec);
const [fixedInvariant] = step2.invariants;
console.log(`  visited ${step2.visitedCount} states`);
console.log(fixedInvariant?.holds === true ? `  holds: ${fixedInvariant.name}` : '  still violated');

console.log('\nStep 3: checking a real implementation against the proven-correct spec');
const step3 = checkConformance(fixedSpec, buggyImpl);
if (step3.mismatch === undefined) {
  console.log('  conforms on every reachable transition');
} else {
  console.log(`  MISMATCH on "${step3.mismatch.action}"`);
  console.log(`  trace: ${step3.mismatch.trace.join(' -> ')}`);
  console.log(`  expected: ${JSON.stringify(step3.mismatch.expected)}`);
  console.log(`  actual:   ${JSON.stringify(step3.mismatch.actual)}`);
}

console.log('\nStep 4: the fixed implementation');
const step4 = checkConformance(fixedSpec, fixedImpl);
console.log(
  step4.mismatch === undefined
    ? `  conforms on all ${String(step4.visitedCount)} reachable states`
    : '  still mismatched',
);
