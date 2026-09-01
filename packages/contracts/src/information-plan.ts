import { z } from 'zod';
import { ContentRefSchema, sourceSpanMap, type ContentRef, type SlideIR } from './slide-ir.js';

/**
 * InformationPlan은 내용을 어떤 구조와 순서로 설명할지 정한다.
 * 좌표, 색상, 글꼴, 영역 같은 배치 정보는 넣지 않는다.
 */
export const InformationShapeSchema = z.enum([
  'causal-chain',
  'sequence',
  'comparison',
  'state-transition',
  'hierarchy',
  'metric',
  'hybrid',
]);

export const InformationGroupSchema = z.strictObject({
  groupId: z.string().min(1),
  role: z.enum(['trigger', 'setup', 'transition', 'consequence', 'evidence', 'context']),
  order: z.number().int().nonnegative(),
  blockIds: z.array(z.string().min(1)).min(1),
});

export const InformationPlanSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  informationPlanId: z.string().min(1),
  slideId: z.string().min(1),
  semanticShape: InformationShapeSchema,
  grammarId: z.string().min(1),
  message: ContentRefSchema,
  primaryArtifactBlockId: z.string().min(1),
  readingOrder: z.array(z.string().min(1)).min(1),
  groups: z.array(InformationGroupSchema).min(1),
  relationIds: z.array(z.string().min(1)),
  interpretation: z.strictObject({
    author: z.enum(['deterministic-planner', 'ai-proposal', 'user']),
    confidence: z.number().min(0).max(1).optional(),
    ambiguityIds: z.array(z.string().min(1)),
  }),
});

export type InformationPlan = z.infer<typeof InformationPlanSchema>;

export type InformationPlanIssue = {
  path: string;
  message: string;
};

function expectedContent(ref: ContentRef, slide: SlideIR): string | undefined {
  const spans = ref.sourceSpanIds.map((spanId) => sourceSpanMap(slide.source).get(spanId));
  if (spans.some((span) => span === undefined)) return undefined;
  return ref.transform.kind === 'exact' ? spans[0] : spans.join(ref.transform.separator);
}

/**
 * InformationPlan이 SlideIR의 내용과 관계를 빠뜨리거나 순서를 바꾸지 않는지 검사한다.
 * 이는 배치 품질 검사가 아니라 원문 설명 구조에 대한 보존 검사다.
 */
export function validateInformationPlan(plan: InformationPlan, slide: SlideIR): InformationPlanIssue[] {
  const issues: InformationPlanIssue[] = [];
  const slideBlockIds = slide.blocks.map((block) => block.id);
  const blockIds = new Set(slideBlockIds);
  const relationIds = new Set(slide.relations.map((relation) => relation.id));
  const expectedMessage = expectedContent(plan.message, slide);

  if (plan.slideId !== slide.slideId) {
    issues.push({ path: 'slideId', message: 'InformationPlan이 다른 SlideIR을 가리킵니다.' });
  }
  if (expectedMessage === undefined || expectedMessage !== plan.message.text) {
    issues.push({ path: 'message', message: 'InformationPlan의 메시지가 원문과 일치하지 않습니다.' });
  }
  if (!blockIds.has(plan.primaryArtifactBlockId)) {
    issues.push({ path: 'primaryArtifactBlockId', message: '주요 대상 block이 SlideIR에 없습니다.' });
  }

  const readingSet = new Set(plan.readingOrder);
  if (readingSet.size !== plan.readingOrder.length) {
    issues.push({ path: 'readingOrder', message: '읽는 순서에 같은 block이 중복됩니다.' });
  }
  if (plan.readingOrder.length !== slideBlockIds.length || slideBlockIds.some((id) => !readingSet.has(id))) {
    issues.push({ path: 'readingOrder', message: '읽는 순서에 필수 block이 빠졌거나 존재하지 않는 block이 있습니다.' });
  }
  if (slide.constraints.preserveOrder && plan.readingOrder.some((id, index) => id !== slideBlockIds[index])) {
    issues.push({ path: 'readingOrder', message: '원문 보존 조건에 따라 block 순서를 바꿀 수 없습니다.' });
  }

  const groupIds = new Set<string>();
  const groupedBlockIds: string[] = [];
  const groupOrders = new Set<number>();
  for (const [index, group] of plan.groups.entries()) {
    if (groupIds.has(group.groupId)) {
      issues.push({ path: `groups.${index}.groupId`, message: '정보 그룹 ID가 중복됩니다.' });
    }
    groupIds.add(group.groupId);
    if (groupOrders.has(group.order)) {
      issues.push({ path: `groups.${index}.order`, message: '정보 그룹 순서가 중복됩니다.' });
    }
    groupOrders.add(group.order);
    groupedBlockIds.push(...group.blockIds);
  }
  const groupedSet = new Set(groupedBlockIds);
  if (groupedSet.size !== groupedBlockIds.length) {
    issues.push({ path: 'groups', message: '같은 block이 둘 이상의 정보 그룹에 들어 있습니다.' });
  }
  if (groupedBlockIds.length !== slideBlockIds.length || slideBlockIds.some((id) => !groupedSet.has(id))) {
    issues.push({ path: 'groups', message: '정보 그룹에 필수 block이 빠졌거나 존재하지 않는 block이 있습니다.' });
  }

  const planRelationIds = new Set(plan.relationIds);
  if (planRelationIds.size !== plan.relationIds.length) {
    issues.push({ path: 'relationIds', message: '관계 ID가 중복됩니다.' });
  }
  if (plan.relationIds.length !== relationIds.size || [...relationIds].some((id) => !planRelationIds.has(id))) {
    issues.push({ path: 'relationIds', message: 'InformationPlan에 중요한 관계가 빠졌거나 존재하지 않는 관계가 있습니다.' });
  }

  return issues;
}
