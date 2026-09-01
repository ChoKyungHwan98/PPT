import { readFile } from 'node:fs/promises';
import { PairwisePreferenceRecordSchema, type PairwisePreferenceRecord } from '@game-presentation/contracts';
import { VersionedPreferenceStore } from './store.js';

export async function importPreferenceFile(input: {
  filePath: string;
  store: VersionedPreferenceStore;
}): Promise<{ record: PairwisePreferenceRecord; versionHash: string }> {
  const record = PairwisePreferenceRecordSchema.parse(
    JSON.parse(await readFile(input.filePath, 'utf8')),
  );
  const saved = await input.store.append(record);
  return { record, versionHash: saved.versionHash };
}
