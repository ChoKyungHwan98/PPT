import type { CompositionPlan, InformationPlan, SemanticBlock, SlideIR } from '@game-presentation/contracts';
import type { TeacherDesignGuidance } from '@game-presentation/reference-engine';

type OrganizationComposition = Pick<CompositionPlan, 'regions' | 'bindings'>;
type Assignment = { regionId: string; fragmentRole: string };

function region(
  regionId: string,
  role: CompositionPlan['regions'][number]['role'],
  order: number,
  weight: number,
  parentRegionId?: string,
  flow: CompositionPlan['regions'][number]['flow'] = 'column',
) {
  return {
    regionId,
    role,
    order,
    weight,
    flow,
    gapToken: 'normal' as const,
    paddingToken: 'open' as const,
    ...(parentRegionId === undefined ? {} : { parentRegionId }),
  };
}

function sameSpans(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((spanId, index) => spanId === right[index]);
}

function validateGuidance(guidance: TeacherDesignGuidance): void {
  if (guidance.structureLock.authority !== 'primary-teacher-only'
    || guidance.structureLock.semanticShape !== 'hierarchy'
    || guidance.primaryTeacher.semanticShape !== guidance.structureLock.semanticShape
    || guidance.primaryTeacher.referenceId !== guidance.structureLock.sourceReferenceId) {
    throw new Error('Organization Composition에 적용할 Primary Teacher structure lock이 유효하지 않습니다.');
  }
  if (guidance.copyBoundary.policy !== 'abstract-principles-only'
    || guidance.copyBoundary.exactGeometryReusable
    || guidance.copyBoundary.sourcePaletteReusable
    || guidance.copyBoundary.sourceIpReusable
    || guidance.copyBoundary.sourceAssetReusable) {
    throw new Error('원본 표면 요소를 허용한 Teacher Guidance는 Organization Composition에 적용할 수 없습니다.');
  }
}

function hierarchyStructure(slide: SlideIR) {
  const nodes = slide.blocks.filter((block): block is Extract<SemanticBlock, { kind: 'hierarchy-node' }> =>
    block.kind === 'hierarchy-node');
  if (nodes.length === 0) throw new Error('Organization Composition에는 hierarchy-node가 필요합니다.');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const parentByChild = new Map<string, string>();
  for (const relation of slide.relations.filter((candidate) => candidate.type === 'part-of')) {
    if (!nodeIds.has(relation.fromBlockId) || !nodeIds.has(relation.toBlockId)) {
      throw new Error('part-of 관계의 양쪽은 hierarchy-node여야 합니다.');
    }
    if (parentByChild.has(relation.fromBlockId)) {
      throw new Error(`하나의 hierarchy node에 둘 이상의 부모가 지정되었습니다: ${relation.fromBlockId}`);
    }
    parentByChild.set(relation.fromBlockId, relation.toBlockId);
  }
  if (parentByChild.size === 0) throw new Error('Organization hierarchy에는 authored part-of 관계가 필요합니다.');
  const roots = nodes.filter((node) => !parentByChild.has(node.id));
  if (roots.length === 0) throw new Error('Organization hierarchy의 root를 찾을 수 없습니다.');
  for (const node of nodes) {
    if (!roots.includes(node) && !parentByChild.has(node.id)) {
      throw new Error(`부모 관계가 없는 hierarchy node입니다: ${node.id}`);
    }
  }
  return { nodes, roots, parentByChild };
}

/**
 * Primary hierarchy Guidance를 설명 영역과 책임·소속 구조 영역으로 변환한다.
 * 부모/자식 배치는 오직 authored part-of endpoint를 사용한다.
 */
export function organizationComposition(
  slide: SlideIR,
  information: InformationPlan,
  guidance: TeacherDesignGuidance,
): OrganizationComposition {
  validateGuidance(guidance);
  if (information.semanticShape !== 'hierarchy') {
    throw new Error('Organization Composition은 hierarchy InformationPlan만 받을 수 있습니다.');
  }
  const { nodes, roots, parentByChild } = hierarchyStructure(slide);
  if (!nodes.some((node) => node.id === information.primaryArtifactBlockId)) {
    throw new Error('Organization의 primary artifact는 authored hierarchy node여야 합니다.');
  }

  const hierarchyIds = new Set(nodes.map((node) => node.id));
  const nonHierarchy = information.readingOrder
    .map((blockId) => slide.blocks.find((block) => block.id === blockId))
    .filter((block): block is SemanticBlock => block !== undefined && !hierarchyIds.has(block.id));
  const messageBlock = nonHierarchy.find((block) =>
    block.role === 'context' && sameSpans(block.sourceSpanIds, information.message.sourceSpanIds));
  const titleBlock = nonHierarchy.find((block) => block.kind === 'heading' && block.id !== messageBlock?.id);
  const explanationBlocks = nonHierarchy.filter((block) => block.id !== titleBlock?.id);
  if (explanationBlocks.length === 0) {
    throw new Error('Organization Composition에는 구조도와 중복되지 않는 설명 원문이 필요합니다.');
  }

  const readingPosition = new Map(information.readingOrder.map((blockId, index) => [blockId, index]));
  const nodeRegionByBlockId = new Map(nodes.map((node, index) => [node.id, `organization-node-${index}`]));
  const assignments = new Map<string, Assignment>();
  if (titleBlock !== undefined) {
    assignments.set(titleBlock.id, { regionId: 'organization-heading', fragmentRole: 'organization.title' });
  }
  for (const block of explanationBlocks) {
    assignments.set(block.id, {
      regionId: 'organization-explanation',
      fragmentRole: sameSpans(block.sourceSpanIds, information.message.sourceSpanIds)
        ? 'organization.operating-principle'
        : 'organization.explanation',
    });
  }
  const hierarchyRegions = [...nodes]
    .sort((left, right) => (readingPosition.get(left.id) ?? 0) - (readingPosition.get(right.id) ?? 0))
    .map((node) => {
      const parentBlockId = parentByChild.get(node.id);
      const isRoot = roots.some((root) => root.id === node.id);
      const regionId = nodeRegionByBlockId.get(node.id)!;
      assignments.set(node.id, {
        regionId,
        fragmentRole: isRoot ? 'organization.hierarchy-root' : 'organization.hierarchy-child',
      });
      return region(
        regionId,
        isRoot ? 'primary-artifact' : 'evidence',
        readingPosition.get(node.id) ?? 0,
        isRoot ? 1.25 : 1,
        parentBlockId === undefined
          ? 'organization-hierarchy-map'
          : nodeRegionByBlockId.get(parentBlockId),
        'column',
      );
    });

  return {
    regions: [
      region('organization-heading', 'message', 0, 0.18),
      region('organization-body', 'primary-artifact', 1, 0.82, undefined, 'row'),
      region('organization-explanation', 'annotation', 0, 1, 'organization-body', 'column'),
      region('organization-hierarchy-map', 'primary-artifact', 1, 1.55, 'organization-body', 'column'),
      ...hierarchyRegions,
    ],
    bindings: information.readingOrder.map((blockId, readingOrder) => {
      const assignment = assignments.get(blockId);
      const block = slide.blocks.find((candidate) => candidate.id === blockId);
      if (assignment === undefined || block === undefined) {
        throw new Error(`Organization Composition에 배치되지 않은 authored block입니다: ${blockId}`);
      }
      return {
        blockId,
        ...assignment,
        prominence: block.importance,
        readingOrder,
      };
    }),
  };
}
