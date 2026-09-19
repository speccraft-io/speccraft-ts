import { explore } from '../../src/index.js';
import type { Spec } from '../../src/index.js';
import { buggySpec, fixedSpec, type State } from './model.js';

function report(label: string, spec: Spec<State>): void {
  const result = explore(spec);
  const [violation] = result.invariants;
  console.log(`${label}: visited ${result.visitedCount} states`);
  if (violation === undefined) {
    console.log('  no invariants configured');
    return;
  }
  if (violation.holds) {
    console.log(`  holds: ${violation.name}`);
  } else {
    console.log(`  VIOLATED: ${violation.name}`);
    console.log(`  trace: ${violation.counterexample?.join(' -> ') ?? ''}`);
  }
}

report('buggy model', buggySpec);
report('fixed model', fixedSpec);
