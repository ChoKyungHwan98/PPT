import { z } from 'zod';
import { InformationPlanSchema, type InformationPlan, type InformationPlanIssue } from './information-plan.js';
import type { SlideIR } from './slide-ir.js';

export const InformationDesignPrioritySchema = z.enum([
  'fidelity', 'detail', 'rules', 'states', 'numbers', 'exceptions', 'data', 'flows', 'implementation-understanding',
  'message', 'persuasion', 'compression', 'hierarchy', 'readability', 'story',
]);

export const InformationDesignModeResolutionSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  policyId: z.enum(['document-information-design-v1', 'presentation-information-design-v1']),
  mode: z.enum(['document', 'presentation']),
  priorities: z.array(InformationDesignPrioritySchema).min(1),
  sourceDetailPolicy: z.enum(['preserve-all-authored-detail', 'source-preserving-message-led']),
  messagePlacement: z.enum(['contextual', 'lead']),
  compressionPolicy: z.enum(['forbidden', 'structure-only-no-source-omission']),
  relationPolicy: z.literal('preserve-all-authored-relations'),
});

export type InformationDesignModeResolution = z.infer<typeof InformationDesignModeResolutionSchema>;

export function resolveInformationDesignMode(mode: 'document' | 'presentation'): InformationDesignModeResolution {
  return InformationDesignModeResolutionSchema.parse(mode === 'document' ? {
    schemaVersion: '0.1',
    policyId: 'document-information-design-v1',
    mode,
    priorities: ['fidelity', 'detail', 'rules', 'states', 'numbers', 'exceptions', 'data', 'flows', 'implementation-understanding'],
    sourceDetailPolicy: 'preserve-all-authored-detail',
    messagePlacement: 'contextual',
    compressionPolicy: 'forbidden',
    relationPolicy: 'preserve-all-authored-relations',
  } : {
    schemaVersion: '0.1',
    policyId: 'presentation-information-design-v1',
    mode,
    priorities: ['message', 'persuasion', 'compression', 'hierarchy', 'readability', 'story'],
    sourceDetailPolicy: 'source-preserving-message-led',
    messagePlacement: 'lead',
    compressionPolicy: 'structure-only-no-source-omission',
    relationPolicy: 'preserve-all-authored-relations',
  });
}

/** Mode-specific Information Design checks. Source omission remains forbidden in both V1 paths. */
export function validateInformationPlanForMode(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  resolution: InformationDesignModeResolution;
}): InformationPlanIssue[] {
  if (input.resolution.mode === 'document') {
    return input.slide.constraints.contentPolicy === 'verbatim'
      ? []
      : [{ path: 'mode.document.sourceDetailPolicy', message: 'Document mode는 모든 작성 원문을 그대로 보존해야 합니다.' }];
  }

  const messageIds = messageBlockIds(input.slide, input.informationPlan);
  const firstMessageIndex = input.informationPlan.readingOrder.findIndex((blockId) => messageIds.includes(blockId));
  const leadBoundary = Math.max(1, Math.ceil(input.informationPlan.readingOrder.length / 4));
  if (firstMessageIndex < 0 || firstMessageIndex > leadBoundary) {
    return [{
      path: 'mode.presentation.messagePlacement',
      message: 'Presentation mode는 source-traced 핵심 message를 정보 흐름의 앞부분에 배치해야 합니다.',
    }];
  }
  return [];
}

function messageBlockIds(slide: SlideIR, informationPlan: InformationPlan): string[] {
  const messageSpans = new Set(informationPlan.message.sourceSpanIds);
  return slide.blocks
    .filter((block) => block.sourceSpanIds.some((spanId) => messageSpans.has(spanId)))
    .map((block) => block.id);
}

/**
 * Applies only the approved R2 information-order difference. It never removes blocks,
 * relations, groups, or source text and does not make layout decisions.
 */
export function applyInformationDesignMode(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  resolution: InformationDesignModeResolution;
}): InformationPlan {
  if (input.slide.constraints.preserveOrder) {
    return InformationPlanSchema.parse(input.informationPlan);
  }
  if (input.resolution.mode === 'document') {
    return InformationPlanSchema.parse({
      ...input.informationPlan,
      readingOrder: [...input.slide.blocks]
        .sort((left, right) => left.order - right.order)
        .map((block) => block.id),
    });
  }
  const messageIds = messageBlockIds(input.slide, input.informationPlan);
  if (messageIds.length === 0) return InformationPlanSchema.parse(input.informationPlan);
  const lead = [input.informationPlan.primaryArtifactBlockId, ...messageIds];
  const leadSet = new Set(lead);
  return InformationPlanSchema.parse({
    ...input.informationPlan,
    readingOrder: [
      ...lead.filter((id, index) => lead.indexOf(id) === index),
      ...input.informationPlan.readingOrder.filter((id) => !leadSet.has(id)),
    ],
  });
}
