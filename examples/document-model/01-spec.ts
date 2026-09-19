import type { Action, Invariant } from '../../src/index.js';

type FileStatus = 'absent' | 'converting' | 'converted' | 'removed';
export interface State {
  readonly name: 'n1' | 'n2' | null,
  readonly nameDetected: boolean,
  readonly nameSetManually: boolean,
  readonly files: {
    readonly f1: FileStatus,
    readonly f2: FileStatus,
    readonly f3: FileStatus
  },
  readonly archive: null | { f1: boolean, f2: boolean, f3: boolean },
  readonly summary: {
    readonly fromName: 'n1' | 'n2' | null,
    readonly f1: boolean,
    readonly f2: boolean,
    readonly f3: boolean
  } | null,
  readonly nameDetecting: boolean,
  readonly fileArchiving: boolean,
  readonly summaryGenerating: boolean,
  readonly status: 'new' | 'submitted' | 'deleted',
  readonly submitRequested: boolean,
  readonly summaryRequested: boolean,
  readonly archiveRequested: boolean,
}

export function newState(): State {
  return {
    name: null,
    nameDetected: false,
    nameSetManually: false,
    files: {f1: 'absent', f2: 'absent', f3: 'absent'},
    archive: null,
    summary: null,
    nameDetecting: false,
    fileArchiving: false,
    summaryGenerating: false,
    status: 'new',
    submitRequested: false,
    summaryRequested: false,
    archiveRequested: false,
  }
}

function nameDetectingNeeded(s: State): boolean {
  return s.status === 'new'
    && Object.values(s.files).filter(e => e === 'converted').length >= 2
    && !s.nameDetected
    && !s.nameSetManually;
}

function fileArchivingNeeded(s: State): boolean {
  return s.status === 'new'
    && Object.values(s.files).some(e => e === 'converted')
    && !(s.archive !== null
      && s.archive.f1 === (s.files.f1 === 'converted')
      && s.archive.f2 === (s.files.f2 === 'converted')
      && s.archive.f3 === (s.files.f3 === 'converted'));
}

function summaryGeneratingNeeded(s: State): boolean {
  return s.status === 'new'
    && Object.values(s.files).some(e => e === 'converted')
    && !(s.summary !== null
      && s.summary.fromName === s.name
      && s.summary.f1 === (s.files.f1 === 'converted')
      && s.summary.f2 === (s.files.f2 === 'converted')
      && s.summary.f3 === (s.files.f3 === 'converted'))
    && s.name !== null;
}

export const FILES = ['f1', 'f2', 'f3'] as const;
export type FileId = typeof FILES[number];

function noFileConverting(s: State): boolean {
  return Object.values(s.files).every(e => e !== 'converting');
}

// archive matches converted files
function archiveMatches(s: State): boolean {
  return s.archive !== null
    && s.archive.f1 === (s.files.f1 === 'converted')
    && s.archive.f2 === (s.files.f2 === 'converted')
    && s.archive.f3 === (s.files.f3 === 'converted');
}

// summary matches current name + converted files
function summaryMatches(s: State): boolean {
  return s.summary !== null
    && s.summary.fromName === s.name
    && s.summary.f1 === (s.files.f1 === 'converted')
    && s.summary.f2 === (s.files.f2 === 'converted')
    && s.summary.f3 === (s.files.f3 === 'converted');
}

function withFile(s: State, f: FileId, status: FileStatus): State['files'] {
  return {...s.files, [f]: status};
}

export const ACTIONS: Action<State>[] = [
  // ---- command actions ----
  {
    name: 'delete document',
    guard: (s: State) => s.status === 'new',
    // everything reset, waits released with an error
    effect: (): State => ({...newState(), status: 'deleted'})
  },
  {
    name: 'rename document to n2',
    guard: (s: State) => s.status === 'new',
    // if the name was already n2: cancel nothing, nothing a job reads changed
    effect: (s: State): State => s.name === 'n2'
      ? {...s, name: 'n2', nameSetManually: true}
      : {...s, name: 'n2', nameSetManually: true, nameDetecting: false, summaryGenerating: false}
  },
  ...FILES.map((f): Action<State> => ({
    name: `upload ${f}`,
    guard: (s: State) => s.status === 'new' && (s.files[f] === 'absent' || s.files[f] === 'removed'),
    effect: (s: State): State => ({...s, files: withFile(s, f, 'converting')})
  })),
  ...FILES.map((f): Action<State> => ({
    name: `delete ${f}`,
    guard: (s: State) => s.status === 'new' && (s.files[f] === 'converting' || s.files[f] === 'converted'),
    // if f was converted: cancel all three jobs
    effect: (s: State): State => s.files[f] === 'converted'
      ? {...s, files: withFile(s, f, 'removed'), nameDetecting: false, fileArchiving: false, summaryGenerating: false}
      : {...s, files: withFile(s, f, 'removed')}
  })),
  {
    name: 'download archive',
    guard: (s: State) =>
      s.status !== 'deleted'
      && Object.values(s.files).some(e => e === 'converting' || e === 'converted'),
    effect: (s: State): State => ({...s, archiveRequested: true})
  },
  {
    name: 'get summary',
    guard: (s: State) =>
      s.status !== 'deleted'
      && s.name !== null
      && Object.values(s.files).some(e => e === 'converting' || e === 'converted'),
    effect: (s: State): State => ({...s, summaryRequested: true})
  },
  {
    name: 'submit document',
    guard: (s: State) =>
      s.status === 'new'
      && Object.values(s.files).some(e => e === 'converting' || e === 'converted'),
    effect: (s: State): State => ({...s, submitRequested: true})
  },

  // ---- event actions ----
  {
    name: 'name detection started',
    guard: (s: State) => nameDetectingNeeded(s) && !s.nameDetecting && noFileConverting(s),
    effect: (s: State): State => ({...s, nameDetecting: true})
  },
  {
    name: 'archive started',
    guard: (s: State) => fileArchivingNeeded(s) && !s.fileArchiving && noFileConverting(s),
    effect: (s: State): State => ({...s, fileArchiving: true})
  },
  {
    name: 'summary started',
    guard: (s: State) =>
      summaryGeneratingNeeded(s) && !s.summaryGenerating && noFileConverting(s) && !s.nameDetecting,
    effect: (s: State): State => ({...s, summaryGenerating: true})
  },
  ...FILES.map((f): Action<State> => ({
    name: `conversion finished ${f}`,
    guard: (s: State) => s.files[f] === 'converting',
    // the converted set changed: cancel all three jobs
    effect: (s: State): State =>
      ({...s, files: withFile(s, f, 'converted'), nameDetecting: false, fileArchiving: false, summaryGenerating: false})
  })),
  ...FILES.map((f): Action<State> => ({
    name: `conversion failed ${f}`,
    guard: (s: State) => s.files[f] === 'converting',
    effect: (s: State): State => ({...s, files: withFile(s, f, 'removed')})
  })),
  {
    name: 'name detection finished with n1',
    guard: (s: State) => s.nameDetecting,
    effect: (s: State): State =>
      ({...s, nameDetecting: false, nameDetected: true, name: 'n1', summaryGenerating: false})
  },
  {
    name: 'default name applied',
    guard: (s: State) => s.name === null && Object.values(s.files).some(e => e === 'converted'),
    effect: (s: State): State => ({...s, name: 'n1', summaryGenerating: false})
  },
  {
    name: 'archive finished',
    guard: (s: State) => s.fileArchiving,
    effect: (s: State): State => ({
      ...s,
      fileArchiving: false,
      archive: {
        f1: s.files.f1 === 'converted',
        f2: s.files.f2 === 'converted',
        f3: s.files.f3 === 'converted'
      }
    })
  },
  {
    name: 'summary finished',
    guard: (s: State) => s.summaryGenerating,
    effect: (s: State): State => ({
      ...s,
      summaryGenerating: false,
      summary: {
        fromName: s.name,
        f1: s.files.f1 === 'converted',
        f2: s.files.f2 === 'converted',
        f3: s.files.f3 === 'converted'
      }
    })
  },
  {
    name: 'name detection failed',
    guard: (s: State) => s.nameDetecting,
    effect: (s: State): State => ({...s, nameDetecting: false})
  },
  {
    name: 'archive failed',
    guard: (s: State) => s.fileArchiving,
    effect: (s: State): State => ({...s, fileArchiving: false})
  },
  {
    name: 'summary failed',
    guard: (s: State) => s.summaryGenerating,
    effect: (s: State): State => ({...s, summaryGenerating: false})
  },
  {
    name: 'archive downloaded',
    guard: (s: State) => s.archiveRequested && archiveMatches(s) && noFileConverting(s),
    effect: (s: State): State => ({...s, archiveRequested: false})
  },
  {
    name: 'summary retrieved',
    guard: (s: State) =>
      s.summaryRequested && summaryMatches(s) && noFileConverting(s) && !s.nameDetecting,
    effect: (s: State): State => ({...s, summaryRequested: false})
  },
  {
    name: 'submit completed',
    guard: (s: State) =>
      s.submitRequested
      && s.name !== null
      && noFileConverting(s)
      && !s.nameDetecting
      && archiveMatches(s)
      && summaryMatches(s),
    effect: (s: State): State => ({...s, status: 'submitted', submitRequested: false})
  },
  {
    name: 'document emptied',
    guard: (s: State) =>
      s.status === 'new'
      && Object.values(s.files).every(e => e === 'absent' || e === 'removed')
      && Object.values(s.files).some(e => e === 'removed'),
    // same as delete document
    effect: (): State => ({...newState(), status: 'deleted'})
  },
];

export const INVARIANTS: Invariant<State>[] = [
  {
    name: 'if status is submitted, the archive matches the converted files',
    check: (s: State): boolean =>
      s.status !== 'submitted' || archiveMatches(s)
  },
  {
    name: 'if status is submitted, the summary matches the current name and the converted files',
    check: (s: State): boolean =>
      s.status !== 'submitted' || summaryMatches(s)
  },
  {
    name: 'if status is submitted, at least one file is converted',
    check: (s: State): boolean =>
      s.status !== 'submitted' || Object.values(s.files).some(e => e === 'converted')
  },
  {
    name: 'if status is submitted, no job is running',
    check: (s: State): boolean =>
      s.status !== 'submitted' || (!s.nameDetecting && !s.fileArchiving && !s.summaryGenerating)
  },
  {
    name: 'if the archive matches the converted files, fileArchiving is false',
    check: (s: State): boolean =>
      !archiveMatches(s) || !s.fileArchiving
  },
  {
    name: 'if the summary matches the current name and the converted files, summaryGenerating is false',
    check: (s: State): boolean =>
      !summaryMatches(s) || !s.summaryGenerating
  },
  {
    name: 'if a summary exists, name is not null',
    check: (s: State): boolean =>
      s.summary === null || s.name !== null
  },
  {
    name: 'if a summary exists, its fromName is not null',
    check: (s: State): boolean =>
      s.summary?.fromName !== null
  },
  {
    name: 'if an archive exists, at least one of its flags is true',
    check: (s: State): boolean =>
      s.archive === null || s.archive.f1 || s.archive.f2 || s.archive.f3
  },
  {
    name: 'if nameDetected is true, name is not null',
    check: (s: State): boolean =>
      !s.nameDetected || s.name !== null
  },
  {
    name: 'if nameSetManually is true, name is n2',
    check: (s: State): boolean =>
      !s.nameSetManually || s.name === 'n2'
  },
  {
    name: 'if nameDetecting is true, nameDetected and nameSetManually are false and at least two files are converted',
    check: (s: State): boolean =>
      !s.nameDetecting
      || (!s.nameDetected && !s.nameSetManually
        && Object.values(s.files).filter(e => e === 'converted').length >= 2)
  },
  {
    name: 'if submitRequested is true, status is new',
    check: (s: State): boolean =>
      !s.submitRequested || s.status === 'new'
  },
  {
    name: 'if status is deleted, everything is reset',
    check: (s: State): boolean =>
      s.status !== 'deleted'
      || (!s.submitRequested && !s.summaryRequested && !s.archiveRequested
        && !s.nameDetecting && !s.fileArchiving && !s.summaryGenerating
        && s.name === null && !s.nameDetected && !s.nameSetManually
        && Object.values(s.files).every(e => e === 'absent')
        && s.archive === null && s.summary === null)
  },
  {
    name: 'if status is submitted, no file is converting',
    check: (s: State): boolean =>
      s.status !== 'submitted' || noFileConverting(s)
  },
]

// each must keep failing; one that stops failing means the model changed
export const REFUTED: Invariant<State>[] = [
  {
    name: 'when no job is running, no file is converting and at least one file is converted, the archive matches the converted files',
    check: (s: State): boolean =>
      s.nameDetecting || s.fileArchiving || s.summaryGenerating
      || !noFileConverting(s)
      || !Object.values(s.files).some(e => e === 'converted')
      || archiveMatches(s)
  },
  {
    name: 'an archive never lists a file that is not converted',
    check: (s: State): boolean => {
      const archive = s.archive;
      return archive === null || FILES.every(f => !archive[f] || s.files[f] === 'converted');
    }
  },
  {
    name: 'a summary never lists a file that is not converted',
    check: (s: State): boolean => {
      const summary = s.summary;
      return summary === null || FILES.every(f => !summary[f] || s.files[f] === 'converted');
    }
  },
  {
    name: 'when no job is running, no file is converting, at least one file is converted and name is not null, the summary matches the current name and the converted files',
    check: (s: State): boolean =>
      s.nameDetecting || s.fileArchiving || s.summaryGenerating
      || !noFileConverting(s)
      || !Object.values(s.files).some(e => e === 'converted')
      || s.name === null
      || summaryMatches(s)
  },
]
