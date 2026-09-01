import { describe, expect, it } from 'vitest';
import { claimNextJob, completeJob, createReferenceJob, failJob } from '../src/queue.js';

describe('overnight reference queue', () => {
  it('claims, retries, and completes a bounded job', () => {
    const created = createReferenceJob({
      referenceId: 'reference-1',
      adapterId: 'fake',
      stage: 'analyze-image',
      createdAt: '2026-08-29T00:00:00.000Z',
      maximumAttempts: 2,
    });
    const first = claimNextJob([created], '2026-08-29T00:01:00.000Z');
    expect(first.claimed?.attempt).toBe(1);
    const retry = failJob(first.queue, created.jobId, '2026-08-29T00:02:00.000Z', 'temporary');
    expect(retry[0]?.status).toBe('pending');
    const second = claimNextJob(retry, '2026-08-29T00:03:00.000Z');
    expect(second.claimed?.attempt).toBe(2);
    const completed = completeJob(second.queue, created.jobId, '2026-08-29T00:04:00.000Z');
    expect(completed[0]?.status).toBe('completed');
  });

  it('stops retrying after the configured limit', () => {
    const created = createReferenceJob({
      referenceId: 'reference-1',
      adapterId: 'fake',
      stage: 'ocr',
      createdAt: '2026-08-29T00:00:00.000Z',
      maximumAttempts: 1,
    });
    const claimed = claimNextJob([created], '2026-08-29T00:01:00.000Z');
    const failed = failJob(claimed.queue, created.jobId, '2026-08-29T00:02:00.000Z', 'failed');
    expect(failed[0]?.status).toBe('failed');
    expect(claimNextJob(failed, '2026-08-29T00:03:00.000Z').claimed).toBeUndefined();
  });
});
