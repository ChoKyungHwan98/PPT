import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { z } from 'zod';
import {
  EMPTY_PREFERENCE_STATE,
  PairwisePreferenceRecordSchema,
  PreferenceStateSchema,
  applyPairwisePreference,
  contentHash,
  type PairwisePreferenceRecord,
  type PreferenceState,
} from '@game-presentation/contracts';

const PreferenceSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    records: z.array(PairwisePreferenceRecordSchema),
    state: PreferenceStateSchema,
    updatedAt: z.iso.datetime(),
  })
  .superRefine((snapshot, context) => {
    const replayed = replayPreferences(snapshot.records);
    if (contentHash(replayed) !== contentHash(snapshot.state)) {
      context.addIssue({ code: 'custom', path: ['state'], message: '선택 기록과 학습 상태가 일치하지 않습니다.' });
    }
    const ids = new Set<string>();
    for (const [index, record] of snapshot.records.entries()) {
      if (ids.has(record.preferenceId)) {
        context.addIssue({ code: 'custom', path: ['records', index, 'preferenceId'], message: '선택 기록 ID가 중복됩니다.' });
      }
      ids.add(record.preferenceId);
    }
  });

export type PreferenceSnapshot = {
  schemaVersion: '0.1';
  records: PairwisePreferenceRecord[];
  state: PreferenceState;
  updatedAt: string;
};

export const EMPTY_PREFERENCE_SNAPSHOT: PreferenceSnapshot = {
  schemaVersion: '0.1',
  records: [],
  state: structuredClone(EMPTY_PREFERENCE_STATE),
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export function replayPreferences(records: PairwisePreferenceRecord[]): PreferenceState {
  return records.reduce(
    (state, record) => applyPairwisePreference(state, record),
    structuredClone(EMPTY_PREFERENCE_STATE),
  );
}

function assertInside(baseDir: string, target: string): void {
  const base = resolve(baseDir);
  const resolved = resolve(target);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new Error('preference store 경로가 저장소 밖을 가리킵니다.');
  }
}

export class VersionedPreferenceStore {
  private readonly versionsDir: string;
  private readonly latestPointerPath: string;

  constructor(private readonly baseDir: string) {
    this.versionsDir = join(baseDir, 'versions');
    this.latestPointerPath = join(baseDir, 'latest.json');
    assertInside(baseDir, this.versionsDir);
    assertInside(baseDir, this.latestPointerPath);
  }

  async append(rawRecord: PairwisePreferenceRecord): Promise<{ versionHash: string; snapshot: PreferenceSnapshot }> {
    const record = PairwisePreferenceRecordSchema.parse(rawRecord);
    const current = await this.loadLatest();
    if (current.records.some((candidate) => candidate.preferenceId === record.preferenceId)) {
      throw new Error('이미 저장된 선택 기록입니다: ' + record.preferenceId);
    }
    const snapshot: PreferenceSnapshot = {
      schemaVersion: '0.1',
      records: [...current.records, record],
      state: applyPairwisePreference(current.state, record),
      updatedAt: record.createdAt,
    };
    return { versionHash: await this.save(snapshot), snapshot };
  }

  async save(snapshotInput: PreferenceSnapshot): Promise<string> {
    const snapshot = PreferenceSnapshotSchema.parse(snapshotInput) as PreferenceSnapshot;
    const versionHash = contentHash({ records: snapshot.records, state: snapshot.state });
    await mkdir(this.versionsDir, { recursive: true });
    const versionPath = join(this.versionsDir, versionHash + '.json');
    assertInside(this.baseDir, versionPath);
    await writeFile(versionPath, JSON.stringify(snapshot, null, 2) + '\n', {
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

  async loadLatest(): Promise<PreferenceSnapshot> {
    let pointer: { versionHash: string; versionFile: string };
    try {
      pointer = JSON.parse(await readFile(this.latestPointerPath, 'utf8')) as typeof pointer;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return structuredClone(EMPTY_PREFERENCE_SNAPSHOT);
      }
      throw error;
    }
    const versionPath = join(this.baseDir, pointer.versionFile);
    assertInside(this.baseDir, versionPath);
    const snapshot = PreferenceSnapshotSchema.parse(
      JSON.parse(await readFile(versionPath, 'utf8')),
    ) as PreferenceSnapshot;
    const actualHash = contentHash({ records: snapshot.records, state: snapshot.state });
    if (actualHash !== pointer.versionHash) {
      throw new Error('preference store version hash가 일치하지 않습니다.');
    }
    return snapshot;
  }
}
