import { resolveAlignedFeatureSpec, type SlideIR, type InformationPlan, type CompositionPlan } from '@game-presentation/contracts';
import type { TeacherDesignGuidance } from '@game-presentation/reference-engine';

type AlignedFeatureComposition = Pick<CompositionPlan, 'regions' | 'bindings'>;

function region(
  regionId: string,
  role: CompositionPlan['regions'][number]['role'],
  order: number,
  weight: number,
  parentRegionId?: string,
  flow: CompositionPlan['regions'][number]['flow'] = 'row',
) {
  return {
    regionId,
    role,
    order,
    weight,
    flow,
    gapToken: 'normal' as const,
    paddingToken: 'open' as const,
    ...(parentRegionId ? { parentRegionId } : {}),
  };
}

function guidedAlignedFeatureComposition(
  slide: SlideIR,
  information: InformationPlan,
  guidance: TeacherDesignGuidance,
): AlignedFeatureComposition {
  if (guidance.structureLock.authority !== 'primary-teacher-only'
    || guidance.structureLock.semanticShape !== 'aligned-before-after-spec'
    || guidance.primaryTeacher.semanticShape !== guidance.structureLock.semanticShape
    || guidance.primaryTeacher.referenceId !== guidance.structureLock.sourceReferenceId) {
    throw new Error('Before / After Composition에 적용할 Primary Teacher structure lock이 유효하지 않습니다.');
  }
  if (guidance.copyBoundary.policy !== 'abstract-principles-only'
    || guidance.copyBoundary.exactGeometryReusable
    || guidance.copyBoundary.sourcePaletteReusable
    || guidance.copyBoundary.sourceIpReusable
    || guidance.copyBoundary.sourceAssetReusable) {
    throw new Error('원본 표면 요소를 허용한 Teacher Guidance는 Composition에 적용할 수 없습니다.');
  }

  const structure = resolveAlignedFeatureSpec(slide, information);
  if (!structure) throw new Error('Aligned comparison requires explicit one-to-one authored pairs.');
  const assignments = new Map<string, { regionId: string; fragmentRole: string }>([
    [structure.title.id, { regionId: 'page-heading', fragmentRole: 'comparison.title' }],
    [structure.message.id, { regionId: 'message-context', fragmentRole: 'comparison.message' }],
    [structure.beforeLabel.id, { regionId: 'comparison-before-heading', fragmentRole: 'comparison.before-label' }],
    [structure.afterLabel.id, { regionId: 'comparison-after-heading', fragmentRole: 'comparison.after-label' }],
  ]);
  if (structure.messageLabel) {
    assignments.set(structure.messageLabel.id, {
      regionId: 'message-context',
      fragmentRole: 'comparison.message-label',
    });
  }

  const pairRegions = structure.pairs.flatMap((pair, index) => {
    const pairRegionId = `comparison-pair-${index}`;
    const beforeRegionId = `${pairRegionId}-before`;
    const changeRegionId = `${pairRegionId}-change`;
    const afterRegionId = `${pairRegionId}-after`;
    assignments.set(pair.fromBlockId, { regionId: beforeRegionId, fragmentRole: 'comparison.before' });
    assignments.set(pair.toBlockId, { regionId: afterRegionId, fragmentRole: 'comparison.after' });
    return [
      region(pairRegionId, 'evidence', index, 1, 'comparison-field'),
      region(beforeRegionId, 'support', 0, 0.44, pairRegionId),
      region(changeRegionId, 'annotation', 1, 0.12, pairRegionId),
      region(afterRegionId, 'evidence', 2, 0.44, pairRegionId),
    ];
  });

  return {
    regions: [
      region('comparison-shared-basis', 'message', 0, 0.3, undefined, 'column'),
      region('page-heading', 'message', 0, 0.45, 'comparison-shared-basis', 'column'),
      region('message-context', 'annotation', 1, 0.55, 'comparison-shared-basis', 'column'),
      region('comparison-field', 'primary-artifact', 1, 0.7, undefined, 'column'),
      region('comparison-heading', 'navigation', 0, 0.36, 'comparison-field'),
      region('comparison-before-heading', 'support', 0, 0.5, 'comparison-heading'),
      region('comparison-after-heading', 'evidence', 1, 0.5, 'comparison-heading'),
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

export function alignedFeatureComposition(
  slide: SlideIR,
  information: InformationPlan,
  guidance?: TeacherDesignGuidance,
): AlignedFeatureComposition {
  if (guidance !== undefined) return guidedAlignedFeatureComposition(slide, information, guidance);
  const structure = resolveAlignedFeatureSpec(slide, information);
  if (!structure) throw new Error('Aligned comparison requires explicit one-to-one authored pairs.');
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
