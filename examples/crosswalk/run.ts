import { checkConformance, explore } from '../../src/index.js';
import { spec as buggySpec } from './01-spec.js';
import { spec as fixedSpec } from './02-spec-fixed.js';
import { implementation as buggyImpl } from './03-implementation.js';
import { implementation as fixedImpl } from './04-implementation-fixed.js';

console.log('Step 1: the spec, as first written');
const step1 = explore(buggySpec);
const [violation] = step1.invariants;
console.log(`  visited ${step1.visitedCount} states`);
if (violation !== undefined && !violation.holds) {
  console.log(`  VIOLATED: ${violation.name}`);
  console.log(`  trace: ${violation.counterexample?.join(' -> ') ?? ''}`);
}

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
