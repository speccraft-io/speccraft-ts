import type { RealSystem } from '../../src/index.js';
import { FILES, newState, type FileId, type State } from './01-spec.js';

function withFile(s: State, f: FileId, status: State['files']['f1']): State['files'] {
  return { ...s.files, [f]: status };
}

function apply(s: State, action: string): State {
  for (const f of FILES) {
    if (action === `upload ${f}`) {
      return { ...s, files: withFile(s, f, 'converting') };
    }
    if (action === `delete ${f}`) {
      return s.files[f] === 'converted'
        ? { ...s, files: withFile(s, f, 'removed'), nameDetecting: false, fileArchiving: false, summaryGenerating: false }
        : { ...s, files: withFile(s, f, 'removed') };
    }
    if (action === `conversion finished ${f}`) {
      return {
        ...s,
        files: withFile(s, f, 'converted'),
        nameDetecting: false,
        fileArchiving: false,
        summaryGenerating: false,
      };
    }
    if (action === `conversion failed ${f}`) {
      return { ...s, files: withFile(s, f, 'removed') };
    }
  }

  switch (action) {
    case 'delete document':
    case 'document emptied':
      return { ...newState(), status: 'deleted' };
    case 'rename document to n2':
      return s.name === 'n2'
        ? { ...s, name: 'n2', nameSetManually: true }
        : { ...s, name: 'n2', nameSetManually: true, nameDetecting: false, summaryGenerating: false };
    case 'download archive':
      return { ...s, archiveRequested: true };
    case 'get summary':
      return { ...s, summaryRequested: true };
    case 'submit document':
      return { ...s, submitRequested: true };
    case 'name detection started':
      return { ...s, nameDetecting: true };
    case 'archive started':
      return { ...s, fileArchiving: true };
    case 'summary started':
      return { ...s, summaryGenerating: true };
    case 'name detection finished with n1':
      return { ...s, nameDetecting: false, nameDetected: true, name: 'n1', summaryGenerating: false };
    case 'default name applied':
      return { ...s, name: 'n1', summaryGenerating: false };
    case 'archive finished':
      return {
        ...s,
        fileArchiving: false,
        archive: {
          f1: s.files.f1 === 'converted',
          f2: s.files.f2 === 'converted',
          f3: s.files.f3 === 'converted',
        },
      };
    case 'summary finished':
      return {
        ...s,
        summaryGenerating: false,
        summary: {
          fromName: s.name,
          f1: s.files.f1 === 'converted',
          f2: s.files.f2 === 'converted',
          f3: s.files.f3 === 'converted',
        },
      };
    case 'name detection failed':
      return { ...s, nameDetecting: false };
    case 'archive failed':
      return { ...s, fileArchiving: false };
    case 'summary failed':
      return { ...s, summaryGenerating: false };
    case 'archive downloaded':
      return { ...s, archiveRequested: false };
    case 'summary retrieved':
      return { ...s, summaryRequested: false };
    case 'submit completed':
      return { ...s, status: 'submitted', submitRequested: false };
    default:
      return s;
  }
}

export const implementation: RealSystem<State, State> = { init: newState, apply, project: (s) => s };
