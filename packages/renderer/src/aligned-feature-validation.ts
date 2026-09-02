import { FindingSchema, resolveAlignedFeatureSpec, type Finding, type RenderTree, type SlideIR, type InformationPlan } from '@game-presentation/contracts';

/** Tighten this new path without changing legacy render validation behavior. */
export function validateAlignedFeatureFidelity(input: { slide: SlideIR; informationPlan: InformationPlan; tree: RenderTree }): Finding[] {
  if (input.tree.layoutFamily !== 'aligned-before-after-spec') return [];
  const findings: Finding[] = [];
  const add = (suffix: string, code: 'untraceable-content' | 'missing-relation', message: string) =>
    findings.push(FindingSchema.parse({
      schemaVersion: '0.1', findingId: `comparison-${suffix}`, artifactId: input.tree.renderTreeId,
      stage: 'contract', severity: 'fatal', code, nodeIds: [], message, evidence: {},
    }));
  const structure = resolveAlignedFeatureSpec(input.slide, input.informationPlan);
  if (!structure) {
    add('structure', 'untraceable-content', 'Authored comparison structure is invalid.');
    return findings;
  }
  const textNodes = input.tree.nodes.filter(
    (node): node is Extract<RenderTree['nodes'][number], { kind: 'text' }> => node.kind === 'text' && node.visible,
  );
  const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();
  for (const node of textNodes) {
    if (normalize(node.lines.map((line) => line.text).join(' ')) !== normalize(node.text)) {
      add(`visible-text-${node.nodeId}`, 'untraceable-content', 'Visible line text differs from source-traced content.');
    }
  }
  for (const block of input.slide.blocks) {
    if (textNodes.filter((node) => node.semanticBlockId === block.id && node.sourceUsage !== 'context-repeat').length !== 1) {
      add(`ownership-${block.id}`, 'untraceable-content', 'Each comparison block must have one visible content owner.');
    }
  }
  const messageNodes = textNodes.filter((node) => node.visualRole === 'message-context');
  if (messageNodes.length !== 1 || messageNodes[0]?.text !== input.informationPlan.message.text
    || JSON.stringify(messageNodes[0]?.sourceSpanIds) !== JSON.stringify(input.informationPlan.message.sourceSpanIds)
    || JSON.stringify(messageNodes[0]?.sourceTransform) !== JSON.stringify(input.informationPlan.message.transform)) {
    add('message', 'untraceable-content', 'Comparison message must preserve the authored intent exactly.');
  }
  for (const relation of structure.pairs) {
    const before = textNodes.find((node) => node.semanticBlockId === relation.fromBlockId);
    const after = textNodes.find((node) => node.semanticBlockId === relation.toBlockId);
    const carriers = input.tree.nodes.filter((node) => node.visible && node.relationId === relation.id);
    const carrier = carriers[0];
    if (!before || !after || carriers.length !== 1 || !carrier
      || carrier.kind !== 'shape' || carrier.visualRole !== 'relation-carrier'
      || carrier.relationVisualRole !== 'comparison-change'
      || before.visualRole !== 'comparison-before' || after.visualRole !== 'comparison-after'
      || before.parentId !== after.parentId || before.parentId !== carrier.parentId
      || before.compositionRegionId !== after.compositionRegionId
      || before.box.x >= after.box.x) {
      add(`pair-${relation.id}`, 'missing-relation', 'Visible aligned pair does not match the authored relation.');
    }
  }
  return findings;
}
