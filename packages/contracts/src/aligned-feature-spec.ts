import type { InformationPlan } from './information-plan.js';
import type { SlideIR, SemanticBlock } from './slide-ir.js';

/** Resolves authored comparison edges, never pairs by text or array position. */
export function resolveAlignedFeatureSpec(slide: SlideIR, information: InformationPlan) {
  if (slide.intent.kind !== 'comparison' || information.semanticShape !== 'comparison') return undefined;
  const groupBlocks = (role: 'before' | 'after' | 'context') => {
    const ids = new Set(information.groups.filter((group) => group.role === role).flatMap((group) => group.blockIds));
    return slide.blocks.filter((block) => ids.has(block.id));
  };
  const before = groupBlocks('before');
  const after = groupBlocks('after');
  const context = groupBlocks('context');
  const beforeLabels = before.filter((block) => block.kind === 'heading');
  const afterLabels = after.filter((block) => block.kind === 'heading');
  const titles = context.filter((block) => block.kind === 'heading' && block.role === 'primary');
  const messages = context.filter((block) => block.kind === 'paragraph'
    && JSON.stringify(block.text) === JSON.stringify(information.message));
  const contextLabels = context.filter((block) => block.kind === 'heading' && block.role === 'context');
  const beforeItems = before.filter((block) => block.kind !== 'heading');
  const afterItems = after.filter((block) => block.kind !== 'heading');
  const isText = (block: SemanticBlock) => block.kind === 'paragraph';
  if (beforeLabels.length !== 1 || afterLabels.length !== 1 || titles.length !== 1
    || messages.length !== 1 || contextLabels.length > 1
    || context.length !== titles.length + messages.length + contextLabels.length
    || beforeItems.length === 0 || beforeItems.length !== afterItems.length
    || !beforeItems.every(isText) || !afterItems.every(isText)
    || before.length + after.length + context.length !== slide.blocks.length) return undefined;
  const beforeIds = new Set(beforeItems.map((block) => block.id));
  const afterIds = new Set(afterItems.map((block) => block.id));
  if (slide.relations.length !== beforeItems.length || slide.relations.some((relation) =>
    relation.type !== 'compares-with' || !beforeIds.has(relation.fromBlockId) || !afterIds.has(relation.toBlockId),
  )) return undefined;
  if (new Set(slide.relations.map((relation) => relation.fromBlockId)).size !== beforeItems.length
    || new Set(slide.relations.map((relation) => relation.toBlockId)).size !== afterItems.length) return undefined;
  const position = new Map(information.readingOrder.map((id, order) => [id, order]));
  const pairs = [...slide.relations].sort((a, b) =>
    position.get(a.fromBlockId)! - position.get(b.fromBlockId)!);
  return {
    title: titles[0]!, message: messages[0]!, messageLabel: contextLabels[0],
    beforeLabel: beforeLabels[0]!, afterLabel: afterLabels[0]!, pairs,
  };
}
