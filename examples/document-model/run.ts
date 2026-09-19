import { explore } from '../../src/index.js';
import { ACTIONS, INVARIANTS, REFUTED, newState, type State } from './model.js';

const result = explore({
  init: newState,
  actions: ACTIONS,
  invariants: [...INVARIANTS, ...REFUTED],
  stuck: (s: State) => s.archiveRequested || s.summaryRequested || s.submitRequested,
});

const refutedNames = new Set(REFUTED.map((i) => i.name));
const failed = result.invariants.filter((i) => !refutedNames.has(i.name) && !i.holds);
const noLongerRefuted = result.invariants.filter((i) => refutedNames.has(i.name) && i.holds);

console.log(`Ending: ${result.endings.length}`);
console.log(`Stuck: ${result.stuck.length}`);
console.log(`Visited: ${result.visitedCount}`);
console.log(`Failed invariants: ${failed.length} out of ${INVARIANTS.length}`);
if (noLongerRefuted.length === 0) {
  console.log(`Known-false beliefs: all ${REFUTED.length} confirmed still false (as expected)`);
} else {
  console.log(`WARNING: ${noLongerRefuted.length} known-false belief(s) now hold - the model changed:`);
  for (const invariant of noLongerRefuted) {
    console.log(`  ${invariant.name}`);
  }
}
for (const invariant of failed) {
  console.log(`\n${invariant.name}`);
  if (invariant.counterexample === undefined) {
    continue;
  }
  for (const action of invariant.counterexample) {
    console.log(`  ${action}`);
  }
}
