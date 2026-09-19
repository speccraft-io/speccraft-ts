# Document model example

A real spec, not a toy, taken through the whole method: proven correct with `explore()`, then checked against a real implementation with `checkConformance()`. It ports a spec from an internal case study with a known-correct answer (283,951 reachable states, 15 invariants that all hold, 4 beliefs that are known to be false and must stay false), so the library itself is being checked against a document that already has ground truth.

The full story behind the spec, how it was found and what it caught, is written up at [speccraft.io/case-study-config-document-workflow](https://speccraft.io/case-study-config-document-workflow/). This README covers what the numbered files here add on top of that: an independently-written implementation, and a bug conformance testing catches that model checking alone cannot.

Run the whole story: `npx tsx run.ts` (from this folder). Each step also has its own test file, run with `pnpm test` from the package root.

## Step 1: the spec, matched against the case study (`01-spec.ts`, `01-spec.test.ts`)

The spec itself - variables, actions, invariants, and four known-false beliefs kept on purpose (see below). `explore()` pins the exact numbers from the case study: 283,951 reachable states, every invariant holding, every refuted belief still false.

## Step 2: a real implementation, checked against the proven-correct spec (`02-implementation.ts`, `02-conformance.test.ts`)

A spec being proven correct says nothing about whether the code that is supposed to implement it actually does. `02-implementation.ts` is an independently-written version of the same 23 actions - same effects, no guards (conformance checking only needs to know what an action *does*, since it only ever replays actions the spec has already decided are legal).

It has a bug the spec never had: renaming the document correctly cancels an in-flight name detection, but forgets that a summary build also reads the current name and needs canceling too. `checkConformance()` drives the implementation through every transition the spec says is legal and finds the exact divergence in seconds, not after walking all 283,951 states:

```
MISMATCH on "rename document to n2"
trace: upload f1 -> conversion finished f1 -> default name applied -> summary started -> rename document to n2
expected.summaryGenerating: false
actual.summaryGenerating:   true
```

## Step 3: the fixed implementation (`03-implementation-fixed.ts`, `03-conformance.test.ts`)

Same implementation, one added clause: cancel the summary build too when the name actually changes. `checkConformance()` now walks all 283,951 reachable states with no mismatch - the real code and the proven-correct spec agree everywhere.

## Product requirements

A document starts empty and can take up to three files: f1, f2, f3. Each
upload kicks off a conversion that finishes or fails on its own time. While a
file is converting it cannot be re-uploaded or deleted mid-flight in a way
that skips the wait - the document tracks each file as absent, converting,
converted, or removed.

Once at least two files have converted, the document tries to detect a name
for itself automatically. If the user renames the document by hand first,
that name wins forever and automatic detection never overwrites it. If
detection never gets a chance to run but a file has converted, the document
falls back to a default name rather than being nameless forever.

As soon as any file is converted, the document keeps a downloadable archive
and a summary up to date in the background: whenever the set of converted
files changes, or the name changes, the existing archive or summary is
stale and a new one is built. Archive and summary jobs, and name detection,
never run at the same time as a file conversion, and detection takes
priority over building the summary.

A user can ask to download the archive, get the summary, or submit the
document at any time (as long as at least one file is converting or
converted, and - for summary and submit - the document has a name). That
request waits until the thing it needs is actually fresh, not just
"a build happened at some point" - a stale result from before the last
change never gets served. Submitting only succeeds once the name is set, no
conversion is in flight, and both the archive and the summary are fresh.

The document can be deleted outright, or empties itself automatically once
every file has either never been uploaded or been removed and at least one
was actively removed (as opposed to never touched). Either way, every
pending download/summary/submit request is released with an error - a
request never just hangs forever silently.

## The state machine, in text

### Variables

- `name`: n1, n2, or none. n1 means auto-detected; n2 means set by hand.
- `nameDetected`: true once auto-detection has produced n1.
- `nameSetManually`: true once the user has renamed the document.
- `files.f1`, `files.f2`, `files.f3`: each is absent, converting, converted,
  or removed.
- `archive`: none, or which of f1/f2/f3 it currently lists as converted.
- `summary`: none, or the name it was built from plus which of f1/f2/f3 it
  currently lists as converted.
- `nameDetecting`, `fileArchiving`, `summaryGenerating`: true while that
  background job is running.
- `status`: new, submitted, or deleted.
- `submitRequested`, `summaryRequested`, `archiveRequested`: true while a
  user request is waiting to be served.

### Commands (the user asks; can be refused)

- **delete document** - allowed while new. Resets everything to a fresh,
  deleted document; any pending request is released with an error.
- **rename document to n2** - allowed while new. Sets the name and marks it
  manual; if the name actually changed, cancels an in-progress name
  detection or summary build (they'd be reading a name that just changed).
- **upload f1 / f2 / f3** - allowed while new and that file is absent or
  removed. Marks the file as converting.
- **delete f1 / f2 / f3** - allowed while new and that file is converting or
  converted. Marks the file as removed; if it was converted, cancels name
  detection, archiving, and summary building (the converted set just
  changed under them).
- **download archive** - allowed unless the document is deleted, and at
  least one file is converting or converted. Records that a download is
  wanted.
- **get summary** - same as download archive, plus the document must have a
  name. Records that a summary is wanted.
- **submit document** - allowed while new, and at least one file is
  converting or converted. Records that a submit is wanted.

### Events (the world reports; the document waits, never refuses)

- **name detection started / archive started / summary started** - fire on
  their own once the matching job is needed (see below), no file is
  converting, and (for detection and archiving) that job isn't already
  running, and (for summary) detection also isn't running.
- **conversion finished f / conversion failed f** - fire while f is
  converting. Finishing marks f converted and cancels detection, archiving,
  and summary building. Failing marks f removed and cancels nothing (a
  failed file never joined the converted set, so nothing that reads that
  set is affected).
- **name detection finished with n1** - fires while detection is running;
  sets the name to n1, marks detection done, and cancels a stale summary
  build.
- **default name applied** - fires whenever the name is still unset but a
  file has converted, so the document is never permanently nameless just
  because detection hasn't run.
- **archive finished / summary finished** - fire while that job is running;
  rebuild the archive or summary from whatever is converted (and, for the
  summary, the current name) right now.
- **name detection failed / archive failed / summary failed** - fire while
  that job is running; just clear the job's running flag. The job restarts
  on its own next time it's still needed - a failure is not a giving-up.
- **archive downloaded** - fires while a download is wanted, the archive
  matches what's actually converted, and no file is converting. Clears the
  request.
- **summary retrieved** - same as above for the summary request, and also
  requires detection isn't running.
- **submit completed** - fires while a submit is wanted, the document has a
  name, no file is converting, detection isn't running, and both the
  archive and the summary are fresh. Marks the document submitted.
- **document emptied** - fires once every file is absent or removed and at
  least one was actively removed. Has the same effect as delete document.

A job is "needed" - and so eligible to start - under these conditions:

- **name detection**: the document is new, at least two files are
  converted, and the name hasn't been set (neither automatically nor by
  hand).
- **file archiving**: the document is new, at least one file is converted,
  and the archive doesn't already match the converted set.
- **summary generating**: the document is new, at least one file is
  converted, the document has a name, and the summary doesn't already match
  the current name and converted set.

### Invariants (checked in every reachable state)

- If submitted: the archive matches the converted files, the summary
  matches the current name and converted files, at least one file is
  converted, and no job (detection, archiving, summary) is running.
- If the archive already matches the converted files, archiving isn't
  running. Same for the summary and summary generating.
- If a summary exists, the document has a name, and the summary's recorded
  name isn't none.
- If an archive exists, it lists at least one file as converted (an archive
  is never built for zero files).
- If detection has completed, the document has a name.
- If the name was set manually, it is n2.
- If detection is running, the document has no name yet (neither detected
  nor manual) and at least two files are converted.
- If a submit is wanted, the document is still new.
- If deleted: every request, every job flag, and the name are cleared, every
  file is absent, and there is no archive or summary.
- If submitted, no file is converting.

### Known-false beliefs (kept on purpose, must always stay false)

These describe tempting shortcuts that turn out to be wrong because of the
gap between a cancel and a job's restart:

- "Whenever nothing is running or converting and a file is converted, the
  archive matches" - false: a cancel can leave a stale archive sitting there
  until the next archiving job actually runs.
- "An archive never lists a file that isn't converted" - false: deleting a
  file after the archive was built leaves the old archive pointing at it
  until the next rebuild.
- "A summary never lists a file that isn't converted" - false, same reason.
- "Whenever nothing is running or converting, a file is converted, and the
  document has a name, the summary matches" - false, the summary's version
  of the same archive gap.

Full reasoning for every non-obvious guard and effect - why f3 has to exist,
why cancels are scoped the way they are, why "default name applied" exists
at all - is in the
[write-up](https://speccraft.io/case-study-config-document-workflow/) linked
above.
