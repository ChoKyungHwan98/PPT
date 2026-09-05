import { DesignEvaluationEventSchema, type DesignEvaluationEvent } from '@game-presentation/contracts';

export type CritiqueDatasetRecord = {
  image: string;
  task: 'visual-quality-critique';
  context: { semanticShape: string; authoredContentHash: string; teacherIds: string[]; guidanceIds: string[] };
  critic: DesignEvaluationEvent['critic'];
  human: { decision: DesignEvaluationEvent['userDecision']; reasonTags: DesignEvaluationEvent['reasonTags'] };
};

export function buildCritiqueDataset(events: readonly DesignEvaluationEvent[]): CritiqueDatasetRecord[] {
  return events.map((raw) => {
    const event = DesignEvaluationEventSchema.parse(raw);
    return {
      image: event.png.path,
      task: 'visual-quality-critique',
      context: { semanticShape: event.semanticShape, authoredContentHash: event.authoredContentHash, teacherIds: event.selectedTeacherIds, guidanceIds: event.appliedGuidanceIds },
      critic: event.critic,
      human: { decision: event.userDecision, reasonTags: event.reasonTags },
    };
  });
}

export function buildPairwiseDataset(events: readonly DesignEvaluationEvent[]) {
  return events.filter((event) => event.userDecision === 'prefer-A' || event.userDecision === 'prefer-B').map((event) => ({
    artifactId: event.artifactId,
    preferred: event.userDecision === 'prefer-A' ? 'A' as const : 'B' as const,
    reasonTags: event.reasonTags,
    sourceEventId: event.eventId,
  }));
}

