import { checkConformance, explore } from '../../src/index.js';
import { REFUTED, spec } from './01-spec.js';
import { implementation as buggyImpl } from './02-implementation.js';
import { implementation as fixedImpl } from './03-implementation-fixed.js';

console.log('Step 1: the spec, matched against the case study');
const step1 = explore(spec);
const refutedNames = new Set(REFUTED.map((i) => i.name));
const failed = step1.invariants.filter((i) => !refutedNames.has(i.name) && !i.holds);
const noLongerRefuted = step1.invariants.filter((i) => refutedNames.has(i.name) && i.holds);
console.log(`  Ending: ${step1.endings.length}`);
console.log(`  Stuck: ${step1.stuck.length}`);
console.log(`  Visited: ${step1.visitedCount}`);
console.log(`  Failed invariants: ${failed.length}`);
console.log(
  noLongerRefuted.length === 0
    ? `  Known-false beliefs: all ${REFUTED.length} confirmed still false (as expected)`
    : `  WARNING: ${noLongerRefuted.length} known-false belief(s) now hold`,
);

console.log('\nStep 2: checking a real implementation against the proven-correct spec');
const step2 = checkConformance(spec, buggyImpl);
if (step2.mismatch === undefined) {
  console.log('  conforms on every reachable transition');
} else {
  console.log(`  MISMATCH on "${step2.mismatch.action}"`);
  console.log(`  trace: ${step2.mismatch.trace.join(' -> ')}`);
  console.log(`  expected.summaryGenerating: ${String(step2.mismatch.expected.summaryGenerating)}`);
  console.log(`  actual.summaryGenerating:   ${String(step2.mismatch.actual.summaryGenerating)}`);
}

console.log('\nStep 3: the fixed implementation');
const step3 = checkConformance(spec, fixedImpl);
console.log(
  step3.mismatch === undefined
    ? `  conforms on all ${String(step3.visitedCount)} reachable states`
    : '  still mismatched',
);
