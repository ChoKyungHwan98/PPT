import {
  runV1StudioAuthoring,
  recordV1StudioUserDecision,
  runV1StudioVisualCritic,
  type StudioAuthoringArtifacts,
  type StudioAuthoringOptions,
} from '@game-presentation/authoring-harness';
import type { AIProvider, StudioDesignInput } from '@game-presentation/contracts';
import type { DesignEvaluationEvent } from '@game-presentation/contracts';

export type StudioJobArtifacts = StudioAuthoringArtifacts;

/** HTTP adapter entry point. The authoring-harness owns pipeline order and artifact trace. */
export function runStudioDesignJob(raw: StudioDesignInput, options: StudioAuthoringOptions) {
  return runV1StudioAuthoring(raw, options);
}

/** Critic adapter entry point. Provider choice stays at the API boundary; execution is tracked by the harness. */
export function runStudioVisualCritic(input: { metadataPath: string; provider: AIProvider }) {
  return runV1StudioVisualCritic(input);
}

export function recordStudioUserDecision(input: { metadataPath: string; event: DesignEvaluationEvent }) {
  return recordV1StudioUserDecision(input);
}
