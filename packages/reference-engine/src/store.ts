import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { z } from 'zod';
import {
  ReferenceRecordSchema,
  contentHash,
  type ReferenceRecord,
} from '@game-presentation/contracts';
import { ReferenceJobSchema, type ReferenceJob } from './queue.js';

const ReferenceStoreStateSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  records: z.array(ReferenceRecordSchema),
  jobs: z.array(ReferenceJobSchema),
  analyses: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});

export type ReferenceStoreState = {
  schemaVersion: '0.1';
  records: ReferenceRecord[];
  jobs: ReferenceJob[];
  analyses: Record<string, unknown>;
  updatedAt: string;
};

export const EMPTY_REFERENCE_STORE: ReferenceStoreState = {
  schemaVersion: '0.1',
  records: [],
  jobs: [],
  analyses: {},
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function assertInside(baseDir: string, target: string): void {
  const base = resolve(baseDir);
  const resolved = resolve(target);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new Error('reference store 경로가 저장소 밖을 가리킵니다.');
  }
}

export class VersionedReferenceStore {
  private readonly versionsDir: string;
  private readonly latestPointerPath: string;

  constructor(private readonly baseDir: string) {
    this.versionsDir = join(baseDir, 'versions');
    this.latestPointerPath = join(baseDir, 'latest.json');
    assertInside(baseDir, this.versionsDir);
    assertInside(baseDir, this.latestPointerPath);
  }

  async save(stateInput: ReferenceStoreState): Promise<string> {
    const state = ReferenceStoreStateSchema.parse(stateInput) as ReferenceStoreState;
    const versionHash = contentHash({
      records: state.records,
      jobs: state.jobs,
      analyses: state.analyses,
    });
    await mkdir(this.versionsDir, { recursive: true });
    const versionPath = join(this.versionsDir, versionHash + '.json');
    assertInside(this.baseDir, versionPath);
    await writeFile(versionPath, JSON.stringify(state, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    await writeFile(
      this.latestPointerPath,
      JSON.stringify({ versionHash, versionFile: 'versions/' + versionHash + '.json' }, null, 2) + '\n',
      'utf8',
    );
    return versionHash;
  }

  async loadLatest(): Promise<ReferenceStoreState> {
    let pointer: { versionHash: string; versionFile: string };
    try {
      pointer = JSON.parse(await readFile(this.latestPointerPath, 'utf8')) as typeof pointer;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(EMPTY_REFERENCE_STORE);
      throw error;
    }
    const versionPath = join(this.baseDir, pointer.versionFile);
    assertInside(this.baseDir, versionPath);
    const raw = JSON.parse(await readFile(versionPath, 'utf8')) as unknown;
    const state = ReferenceStoreStateSchema.parse(raw) as ReferenceStoreState;
    const actualHash = contentHash({
      records: state.records,
      jobs: state.jobs,
      analyses: state.analyses,
    });
    if (actualHash !== pointer.versionHash) {
      throw new Error('reference store version hash가 일치하지 않습니다.');
    }
    return state;
  }
}
