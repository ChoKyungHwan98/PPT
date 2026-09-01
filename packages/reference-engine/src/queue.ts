import { z } from 'zod';
import { contentHash } from '@game-presentation/contracts';

export const ReferenceJobSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  jobId: z.string().min(1),
  referenceId: z.string().min(1),
  adapterId: z.string().min(1),
  stage: z.enum(['discover', 'fetch', 'deduplicate', 'analyze-image', 'ocr', 'index']),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  attempt: z.number().int().nonnegative(),
  maximumAttempts: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  error: z.string().min(1).optional(),
});

export type ReferenceJob = z.infer<typeof ReferenceJobSchema>;

export function createReferenceJob(input: {
  referenceId: string;
  adapterId: string;
  stage: ReferenceJob['stage'];
  createdAt: string;
  maximumAttempts?: number;
}): ReferenceJob {
  const stable = {
    referenceId: input.referenceId,
    adapterId: input.adapterId,
    stage: input.stage,
  };
  return ReferenceJobSchema.parse({
    schemaVersion: '0.1',
    jobId: 'job-' + contentHash(stable).slice(0, 16),
    ...stable,
    status: 'pending',
    attempt: 0,
    maximumAttempts: input.maximumAttempts ?? 3,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function claimNextJob(queue: ReferenceJob[], now: string): {
  queue: ReferenceJob[];
  claimed?: ReferenceJob;
} {
  const index = queue.findIndex(
    (job) => job.status === 'pending' && job.attempt < job.maximumAttempts,
  );
  if (index < 0) return { queue: [...queue] };
  const claimed = ReferenceJobSchema.parse({
    ...queue[index],
    status: 'running',
    attempt: queue[index]!.attempt + 1,
    updatedAt: now,
  });
  const next = [...queue];
  next[index] = claimed;
  return { queue: next, claimed };
}

export function completeJob(queue: ReferenceJob[], jobId: string, now: string): ReferenceJob[] {
  return queue.map((job) =>
    job.jobId === jobId
      ? ReferenceJobSchema.parse({ ...job, status: 'completed', updatedAt: now, error: undefined })
      : job,
  );
}

export function failJob(
  queue: ReferenceJob[],
  jobId: string,
  now: string,
  error: string,
): ReferenceJob[] {
  return queue.map((job) => {
    if (job.jobId !== jobId) return job;
    const exhausted = job.attempt >= job.maximumAttempts;
    return ReferenceJobSchema.parse({
      ...job,
      status: exhausted ? 'failed' : 'pending',
      updatedAt: now,
      error,
    });
  });
}
