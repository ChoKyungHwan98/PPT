import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createReferenceJob } from '../src/queue.js';
import { VersionedReferenceStore, type ReferenceStoreState } from '../src/store.js';
import { runReferenceBatch } from '../src/worker.js';

describe('versioned overnight processing', () => {
  it('checkpoints each completed job and resumes from the latest version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'game-presentation-reference-store-'));
    const store = new VersionedReferenceStore(directory);
    const initial: ReferenceStoreState = {
      schemaVersion: '0.1',
      records: [],
      jobs: [
        createReferenceJob({
          referenceId: 'reference-1',
          adapterId: 'fake',
          stage: 'analyze-image',
          createdAt: '2026-08-29T00:00:00.000Z',
        }),
      ],
      analyses: {},
      updatedAt: '2026-08-29T00:00:00.000Z',
    };
    await store.save(initial);
    let clock = 0;
    const completed = await runReferenceBatch({
      initialState: await store.loadLatest(),
      handlers: {
        'analyze-image': async ({ job }) => ({
          analyses: { [job.referenceId]: { accepted: true } },
        }),
      },
      maximumJobs: 10,
      now: () => '2026-08-29T00:0' + String(clock++) + ':00.000Z',
      onCheckpoint: async (state) => {
        await store.save(state);
      },
    });
    expect(completed.jobs[0]?.status).toBe('completed');
    expect((await store.loadLatest()).analyses['reference-1']).toEqual({ accepted: true });
  });
});
