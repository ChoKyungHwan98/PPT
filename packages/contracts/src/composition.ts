import { z } from 'zod';
import type { PatternFragment, ReferenceRecord } from './reference.js';
import { ReadingPathSchema } from './reference.js';
import { validateInformationPlan, type InformationPlan } from './information-plan.js';
import type { SlideIR } from './slide-ir.js';

export const PageProfileSchema = z.strictObject({
  id: z.enum(['pdf-a4-portrait', 'pdf-a4-landscape', 'pdf-presentation-16:9', 'html-presentation-16:9']),
  outputFamily: z.enum(['pdf-document', 'pdf-presentation', 'html-presentation']),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.literal('css-px'),
  pixelRatio: z.number().positive(),
});

export type PageProfile = z.infer<typeof PageProfileSchema>;

export const PAGE_PROFILES = {
  pdfA4Portrait: PageProfileSchema.parse({
    id: 'pdf-a4-portrait',
    outputFamily: 'pdf-document',
    width: 794,
    height: 1123,
    unit: 'css-px',
    pixelRatio: 2,
  }),
  pdfA4Landscape: PageProfileSchema.parse({
    id: 'pdf-a4-landscape',
    outputFamily: 'pdf-document',
    width: 1123,
    height: 794,
    unit: 'css-px',
    pixelRatio: 2,
  }),
  pdfPresentation: PageProfileSchema.parse({
    id: 'pdf-presentation-16:9',
    outputFamily: 'pdf-presentation',
    width: 1920,
    height: 1080,
    unit: 'css-px',
    pixelRatio: 1,
  }),
  htmlPresentation: PageProfileSchema.parse({
    id: 'html-presentation-16:9',
    outputFamily: 'html-presentation',
    width: 1920,
    height: 1080,
    unit: 'css-px',
    pixelRatio: 1,
  }),
} as const;

const RegionRoleSchema = z.enum(['message', 'primary-artifact', 'support', 'evidence', 'navigation', 'annotation']);

const RegionSchema = z.strictObject({
  regionId: z.string().min(1),
  parentRegionId: z.string().min(1).optional(),
  role: RegionRoleSchema,
  flow: z.enum(['row', 'column', 'overlay', 'radial', 'free-composition']),
  order: z.number().int().nonnegative(),
  weight: z.number().positive(),
  gapToken: z.enum(['none', 'tight', 'normal', 'open']),
  paddingToken: z.enum(['none', 'tight', 'normal', 'open']),
});

const BlockBindingSchema = z.strictObject({
  blockId: z.string().min(1),
  regionId: z.string().min(1),
  fragmentRole: z.string().min(1),
  prominence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  readingOrder: z.number().int().nonnegative(),
});

export const CompositionPlanSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  planId: z.string().min(1),
  slideId: z.string().min(1),
  informationPlanId: z.string().min(1),
  seed: z.number().int().nonnegative(),
  pageProfile: PageProfileSchema,
  retrievalBriefId: z.string().min(1),
  referenceIds: z.array(z.string().min(1)).min(1),
  patternFragmentIds: z.array(z.string().min(1)).min(1),
  layout: z.strictObject({
    layoutFamily: z.string().min(1),
    readingPath: ReadingPathSchema,
    rationale: z.string().min(1),
  }),
  regions: z.array(RegionSchema).min(1),
  bindings: z.array(BlockBindingSchema).min(1),
  styleIntent: z.strictObject({
    tone: z.string().min(1),
    contrastModel: z.enum(['quiet-field-strong-focus', 'high-contrast-stage', 'editorial-hierarchy']),
    hierarchy: z.strictObject({
      primaryTextSize: z.number().min(32).max(120),
      supportTextSize: z.number().min(16).max(72),
      evidenceTextSize: z.number().min(20).max(96),
      primaryWeight: z.number().int().min(100).max(900),
      supportWeight: z.number().int().min(100).max(900),
    }),
    accent: z.strictObject({
      targetRole: RegionRoleSchema,
      color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
      softColor: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
    }),
    motif: z.strictObject({
      family: z.enum(['threshold-plane', 'causal-spine', 'editorial-rule', 'focus-field']),
      color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
      strokeWidth: z.number().positive().max(24),
    }),
    palette: z.strictObject({
      background: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
      ink: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
      mutedInk: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
      connector: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
    }),
  }),
  qualityFloor: z.strictObject({
    requireAllBlocks: z.literal(true),
    requireAllRelations: z.literal(true),
    maximumSevereFindings: z.literal(0),
    allowCandidateOmission: z.literal(true),
  }),
});

export type CompositionPlan = z.infer<typeof CompositionPlanSchema>;

export type CompositionContractIssue = {
  path: string;
  message: string;
};

export function validateCompositionPlan(
  plan: CompositionPlan,
  slide: SlideIR,
  informationPlan: InformationPlan,
  fragments: PatternFragment[],
  references: ReferenceRecord[],
): CompositionContractIssue[] {
  const issues: CompositionContractIssue[] = [];
  const blockIds = new Set(slide.blocks.map((block) => block.id));
  const boundBlockIds = new Set(plan.bindings.map((binding) => binding.blockId));
  const regionIds = new Set(plan.regions.map((region) => region.regionId));
  const fragmentIds = new Set(fragments.map((fragment) => fragment.fragmentId));
  const fragmentMap = new Map(fragments.map((fragment) => [fragment.fragmentId, fragment]));
  const referenceMap = new Map(references.map((reference) => [reference.referenceId, reference]));
  const informationIssues = validateInformationPlan(informationPlan, slide);

  if (plan.slideId !== slide.slideId) {
    issues.push({ path: 'slideId', message: 'CompositionPlan이 다른 SlideIR을 가리킵니다.' });
  }
  if (plan.informationPlanId !== informationPlan.informationPlanId) {
    issues.push({ path: 'informationPlanId', message: 'CompositionPlan이 다른 InformationPlan을 가리킵니다.' });
  }
  for (const issue of informationIssues) {
    issues.push({ path: `informationPlan.${issue.path}`, message: issue.message });
  }
  for (const blockId of blockIds) {
    if (!boundBlockIds.has(blockId)) {
      issues.push({ path: 'bindings', message: '배치되지 않은 block입니다: ' + blockId });
    }
  }
  for (const [index, binding] of plan.bindings.entries()) {
    if (!blockIds.has(binding.blockId)) {
      issues.push({ path: 'bindings.' + index + '.blockId', message: '존재하지 않는 block입니다.' });
    }
    if (!regionIds.has(binding.regionId)) {
      issues.push({ path: 'bindings.' + index + '.regionId', message: '존재하지 않는 region입니다.' });
    }
  }
  const bindingsByOrder = [...plan.bindings].sort((left, right) => left.readingOrder - right.readingOrder);
  if (
    bindingsByOrder.length !== informationPlan.readingOrder.length ||
    bindingsByOrder.some((binding, index) => binding.blockId !== informationPlan.readingOrder[index])
  ) {
    issues.push({ path: 'bindings.readingOrder', message: 'CompositionPlan의 읽는 순서가 InformationPlan과 다릅니다.' });
  }
  for (const [index, region] of plan.regions.entries()) {
    if (region.parentRegionId !== undefined && !regionIds.has(region.parentRegionId)) {
      issues.push({ path: 'regions.' + index + '.parentRegionId', message: '존재하지 않는 부모 region입니다.' });
    }
  }
  for (const fragmentId of plan.patternFragmentIds) {
    if (!fragmentIds.has(fragmentId)) {
      issues.push({ path: 'patternFragmentIds', message: '존재하지 않는 pattern fragment입니다: ' + fragmentId });
    }
  }
  const selectedFragments = plan.patternFragmentIds
    .map((fragmentId) => fragmentMap.get(fragmentId))
    .filter((fragment): fragment is PatternFragment => fragment !== undefined);
  if (
    selectedFragments.length > 0 &&
    !selectedFragments.some(
      (fragment) =>
        fragment.topology.family === plan.layout.layoutFamily &&
        fragment.readingPath === plan.layout.readingPath,
    )
  ) {
    issues.push({
      path: 'layout',
      message: '선택한 pattern fragment의 topology와 Composition layout이 일치하지 않습니다.',
    });
  }
  for (const referenceId of plan.referenceIds) {
    const reference = referenceMap.get(referenceId);
    if (reference === undefined) {
      issues.push({ path: 'referenceIds', message: '존재하지 않는 reference입니다: ' + referenceId });
      continue;
    }
    if (!reference.allowedUse.analyze || !reference.allowedUse.deriveAbstractPattern) {
      issues.push({ path: 'referenceIds', message: '구조 추출이 허용되지 않은 reference입니다: ' + referenceId });
    }
    if (
      selectedFragments.length > 0 &&
      !selectedFragments.some((fragment) => fragment.sourceReferenceIds.includes(referenceId))
    ) {
      issues.push({
        path: 'referenceIds',
        message: '선택한 pattern fragment로 역추적되지 않는 reference입니다: ' + referenceId,
      });
    }
  }
  return issues;
}
