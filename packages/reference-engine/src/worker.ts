import {
  claimNextJob,
  completeJob,
  failJob,
  type ReferenceJob,
} from './queue.js';
import type { ReferenceStoreState } from './store.js';

export type ReferenceJobHandler = (input: {
  job: ReferenceJob;
  state: ReferenceStoreState;
}) => Promise<{
  analyses?: Record<string, unknown>;
  records?: ReferenceStoreState['records'];
}>;

export type ReferenceJobHandlers = Partial<Record<ReferenceJob['stage'], ReferenceJobHandler>>;

export async function runReferenceBatch(input: {
  initialState: ReferenceStoreState;
  handlers: ReferenceJobHandlers;
  maximumJobs: number;
  now: () => string;
  signal?: AbortSignal;
  onCheckpoint?: (state: ReferenceStoreState) => Promise<void>;
}): Promise<ReferenceStoreState> {
  let state = structuredClone(input.initialState);
  for (let processed = 0; processed < input.maximumJobs; processed += 1) {
    if (input.signal?.aborted) break;
    const claim = claimNextJob(state.jobs, input.now());
    if (claim.claimed === undefined) break;
    state = { ...state, jobs: claim.queue, updatedAt: input.now() };
    const handler = input.handlers[claim.claimed.stage];
    if (handler === undefined) {
      state = {
        ...state,
        jobs: failJob(state.jobs, claim.claimed.jobId, input.now(), 'missing-handler'),
        updatedAt: input.now(),
      };
      await input.onCheckpoint?.(state);
      continue;
    }
    try {
      const result = await handler({ job: claim.claimed, state });
      state = {
        ...state,
        records: result.records ?? state.records,
        analyses: { ...state.analyses, ...(result.analyses ?? {}) },
        jobs: completeJob(state.jobs, claim.claimed.jobId, input.now()),
        updatedAt: input.now(),
      };
    } catch (error) {
      state = {
        ...state,
        jobs: failJob(
          state.jobs,
          claim.claimed.jobId,
          input.now(),
          error instanceof Error ? error.message : String(error),
        ),
        updatedAt: input.now(),
      };
    }
    await input.onCheckpoint?.(state);
  }
  return state;
}
