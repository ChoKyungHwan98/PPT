import { resolveAlignedFeatureSpec, type SlideIR, type InformationPlan, type CompositionPlan } from '@game-presentation/contracts';

export function alignedFeatureComposition(slide: SlideIR, information: InformationPlan):
  Pick<CompositionPlan, 'regions' | 'bindings'> {
  const structure = resolveAlignedFeatureSpec(slide, information);
  if (!structure) throw new Error('Aligned comparison requires explicit one-to-one authored pairs.');
  const region = (regionId: string, role: CompositionPlan['regions'][number]['role'], order: number, weight: number, parentRegionId?: string) => ({
    regionId, role, order, weight, flow: 'row' as const, gapToken: 'normal' as const, paddingToken: 'open' as const,
    ...(parentRegionId ? { parentRegionId } : {}),
  });
  const assignments = new Map<string, { regionId: string; fragmentRole: string }>([
    [structure.title.id, { regionId: 'page-heading', fragmentRole: 'comparison.title' }],
    [structure.message.id, { regionId: 'message-context', fragmentRole: 'comparison.message' }],
    [structure.beforeLabel.id, { regionId: 'comparison-heading', fragmentRole: 'comparison.before-label' }],
    [structure.afterLabel.id, { regionId: 'comparison-heading', fragmentRole: 'comparison.after-label' }],
  ]);
  if (structure.messageLabel) assignments.set(structure.messageLabel.id, { regionId: 'message-context', fragmentRole: 'comparison.message-label' });
  const pairRegions = structure.pairs.map((pair, index) => {
    const regionId = `comparison-pair-${index}`;
    assignments.set(pair.fromBlockId, { regionId, fragmentRole: 'comparison.before' });
    assignments.set(pair.toBlockId, { regionId, fragmentRole: 'comparison.after' });
    return region(regionId, 'evidence', index, 1, 'comparison-field');
  });
  return {
    regions: [
      region('page-heading', 'message', 0, 0.16),
      region('message-context', 'annotation', 1, 0.18),
      region('comparison-heading', 'navigation', 2, 0.14),
      region('comparison-field', 'primary-artifact', 3, 0.52),
      ...pairRegions,
    ],
    bindings: information.readingOrder.map((id, readingOrder) => {
      const assignment = assignments.get(id);
      const block = slide.blocks.find((candidate) => candidate.id === id);
      if (!assignment || !block) throw new Error('Unassigned comparison content.');
      return { blockId: id, ...assignment, prominence: block.importance, readingOrder };
    }),
  };
}
