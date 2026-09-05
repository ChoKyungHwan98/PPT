import { DesignEvaluationEventSchema, PreferenceEvidenceEventSchema, type DesignEvaluationEvent, type PreferenceEvidenceEvent } from '@game-presentation/contracts';

export function exportCritiqueSftDataset(events: readonly DesignEvaluationEvent[]) {
  return events.map((raw) => {
    const event = DesignEvaluationEventSchema.parse(raw);
    return { sourceEventId: event.eventId, image: event.png.path, semanticShape: event.semanticShape, critic: event.critic, humanDecision: event.userDecision, reasonTags: [...event.reasonTags] };
  });
}

export function exportPairwisePreferenceDataset(events: readonly PreferenceEvidenceEvent[]) {
  return events.flatMap((raw) => {
    const event = PreferenceEvidenceEventSchema.parse(raw);
    if (event.selectedCandidateId === null) return [];
    return event.candidateIds.filter((candidateId) => candidateId !== event.selectedCandidateId).map((rejectedCandidateId) => ({
      sourceEventId: event.eventId, chosenCandidateId: event.selectedCandidateId!, rejectedCandidateId, semanticShape: event.semanticShape, mode: event.mode, reasonTags: [...event.reasonTags],
    }));
  });
}

export function exportReadyRejectDataset(events: readonly DesignEvaluationEvent[]) {
  return events.map((raw) => DesignEvaluationEventSchema.parse(raw)).filter((event) => event.userDecision === 'ready' || event.userDecision === 'reject').map((event) => ({
    sourceEventId: event.eventId, image: event.png.path, label: event.userDecision, semanticShape: event.semanticShape, reasonTags: [...event.reasonTags],
  }));
}
