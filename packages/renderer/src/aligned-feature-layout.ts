import {
  RenderTreeSchema, contentHash, type CompositionPlan, type ContentRef, type InformationPlan,
  type RenderNode, type SlideIR,
} from '@game-presentation/contracts';
import type { FontAsset } from './font.js';
import { fontHashForWeight, vectorNode } from './node-builders.js';
import type { TextMeasureRequest, TextMeasurement } from './measure.js';

type Binding = CompositionPlan['bindings'][number];
type Box = RenderNode['box'];
type Input = { slide: SlideIR; informationPlan: InformationPlan; plan: CompositionPlan };

export type AlignedFeaturePresentationRevision = {
  revisionId: 'critic-targeted-revision-1';
  tightenSpaceUse: boolean;
  strengthenGrouping: boolean;
  strengthenRelation: boolean;
};

function content(input: Input, binding: Binding): ContentRef {
  const block = input.slide.blocks.find((entry) => entry.id === binding.blockId);
  if (!block || (block.kind !== 'heading' && block.kind !== 'paragraph')) {
    throw new Error('Aligned feature spec requires authored text blocks.');
  }
  return block.text;
}

function style(plan: CompositionPlan, role: string) {
  const h = plan.styleIntent.hierarchy;
  switch (role) {
    case 'comparison.title': return { size: h.primaryTextSize, weight: h.primaryWeight };
    case 'comparison.message': return { size: h.evidenceTextSize, weight: h.supportWeight };
    case 'comparison.message-label': return { size: h.supportTextSize * 2 / 3, weight: h.primaryWeight };
    case 'comparison.before-label': return { size: h.supportTextSize, weight: h.supportWeight };
    case 'comparison.after-label': return { size: h.supportTextSize, weight: h.primaryWeight };
    case 'comparison.before': return { size: h.supportTextSize, weight: h.supportWeight };
    case 'comparison.after': return { size: h.evidenceTextSize, weight: h.primaryWeight };
    default: throw new Error(`Unsupported comparison binding role: ${role}`);
  }
}

const key = (id: string, text: string) => `aligned:${id}:${text}`;
function authoredLines(text: string) {
  return text.split(/\r?\n/u).map((line) => line.trim().split(/\s+/u).filter(Boolean)).filter((words) => words.length);
}

/** Measure whole word spans with real kerning. Wrapping never estimates widths or shrinks type. */
export function alignedFeatureMeasureRequests(input: Input): TextMeasureRequest[] {
  const requests = new Map<string, TextMeasureRequest>();
  for (const binding of input.plan.bindings) {
    const ref = content(input, binding);
    for (const words of authoredLines(ref.text)) {
      for (let start = 0; start < words.length; start++) {
        for (let end = start + 1; end <= words.length; end++) {
          const text = words.slice(start, end).join(' ');
          const request = {
            key: key(binding.blockId, text), text, family: 'Pretendard',
            ...style(input.plan, binding.fragmentRole), letterSpacing: -0.4,
          };
          requests.set(request.key, request);
        }
      }
    }
  }
  return [...requests.values()];
}

function wrappedMeasures(ref: ContentRef, binding: Binding, width: number, measures: Map<string, TextMeasurement>) {
  const result: TextMeasurement[] = [];
  for (const words of authoredLines(ref.text)) {
    let start = 0;
    while (start < words.length) {
      let accepted: TextMeasurement | undefined;
      let next = start;
      for (let end = start + 1; end <= words.length; end++) {
        const measurement = measures.get(key(binding.blockId, words.slice(start, end).join(' ')));
        if (!measurement) throw new Error('Missing production text measurement.');
        if (measurement.width > width) break;
        accepted = measurement;
        next = end;
      }
      if (!accepted) throw new Error('An authored word exceeds the comparison field; no automatic type reduction.');
      result.push(accepted);
      start = next;
    }
  }
  return result;
}

export function buildAlignedFeatureRenderTree(input: Input & {
  measures: Map<string, TextMeasurement>; fonts: FontAsset[];
  presentationRevision?: AlignedFeaturePresentationRevision;
}) {
  const { plan } = input;
  const width = plan.pageProfile.width;
  const height = plan.pageProfile.height;
  const scale = width / 1920;
  const revision = input.presentationRevision;
  const bounds: Box = revision?.tightenSpaceUse
    ? { x: width * 0.045, y: height * 0.045, width: width * 0.91, height: height * 0.90 }
    : { x: width * 0.05, y: height * 0.07, width: width * 0.90, height: height * 0.84 };
  const teacherGuided = plan.regions.some((region) => region.regionId === 'comparison-shared-basis');
  const roots = plan.regions.filter((region) => region.parentRegionId === undefined).sort((a, b) => a.order - b.order);
  const effectiveWeight = (region: CompositionPlan['regions'][number]) => {
    if (revision?.tightenSpaceUse && teacherGuided && region.regionId === 'comparison-shared-basis') return 0.24;
    if (revision?.tightenSpaceUse && teacherGuided && region.regionId === 'comparison-field') return 0.76;
    if (revision?.strengthenRelation && /^comparison-pair-\d+-(?:before|after)$/u.test(region.regionId)) return 0.42;
    if (revision?.strengthenRelation && /^comparison-pair-\d+-change$/u.test(region.regionId)) return 0.16;
    return region.weight;
  };
  const total = roots.reduce((sum, region) => sum + effectiveWeight(region), 0);
  const boxes = new Map<string, Box>();
  let y = bounds.y;
  for (const root of roots) {
    const box = { x: bounds.x, y, width: bounds.width, height: bounds.height * effectiveWeight(root) / total };
    boxes.set(root.regionId, box);
    y += box.height;
    const children = plan.regions.filter((region) => region.parentRegionId === root.regionId).sort((a, b) => a.order - b.order);
    const sum = children.reduce((value, region) => value + effectiveWeight(region), 0);
    let childY = box.y;
    for (const child of children) {
      const childBox = { ...box, y: childY, height: box.height * effectiveWeight(child) / sum };
      boxes.set(child.regionId, childBox);
      childY += childBox.height;
    }
  }
  if (teacherGuided) {
    const layoutChildren = (parentId: string): void => {
      const parent = plan.regions.find((region) => region.regionId === parentId);
      const parentBox = boxes.get(parentId);
      if (!parent || !parentBox) return;
      const children = plan.regions
        .filter((region) => region.parentRegionId === parentId)
        .sort((a, b) => a.order - b.order);
      if (children.length === 0) return;
      const totalWeight = children.reduce((sum, child) => sum + effectiveWeight(child), 0);
      let offset = parent.flow === 'row' ? parentBox.x : parentBox.y;
      for (const child of children) {
        const ratio = effectiveWeight(child) / totalWeight;
        const childBox = parent.flow === 'row'
          ? { x: offset, y: parentBox.y, width: parentBox.width * ratio, height: parentBox.height }
          : { x: parentBox.x, y: offset, width: parentBox.width, height: parentBox.height * ratio };
        boxes.set(child.regionId, childBox);
        offset += parent.flow === 'row' ? childBox.width : childBox.height;
        layoutChildren(child.regionId);
      }
    };
    for (const root of roots) layoutChildren(root.regionId);
  }
  const requiredBox = (id: string) => {
    const box = boxes.get(id);
    if (!box) throw new Error(`Missing composition region: ${id}`);
    return box;
  };
  const field = requiredBox('comparison-field');
  const headers = requiredBox('comparison-heading');
  const gap = 112 * scale;
  const columnWidth = (field.width - gap) / 2;
  const guidedBeforeHeader = teacherGuided ? requiredBox('comparison-before-heading') : undefined;
  const guidedAfterHeader = teacherGuided ? requiredBox('comparison-after-heading') : undefined;
  const leftX = guidedBeforeHeader ? guidedBeforeHeader.x + 32 * scale : field.x + 32 * scale;
  const rightX = guidedAfterHeader ? guidedAfterHeader.x + 32 * scale : field.x + columnWidth + gap + 32 * scale;
  const textWidth = guidedBeforeHeader ? guidedBeforeHeader.width - 64 * scale : columnWidth - 64 * scale;
  const nodes: RenderNode[] = plan.regions.map((region) => ({
    nodeId: `region-${region.regionId}`, kind: 'group',
    ...(region.parentRegionId ? { parentId: `region-${region.parentRegionId}` } : {}),
    compositionRegionId: region.regionId,
    visualRole: region.parentRegionId ? 'comparison-pair' : 'comparison-field',
    zIndex: 0, box: requiredBox(region.regionId), clip: false, visible: true,
  }));
  const tonalBox = teacherGuided && guidedAfterHeader
    ? { x: guidedAfterHeader.x, y: headers.y, width: guidedAfterHeader.width, height: field.y + field.height - headers.y }
    : {
        x: rightX - 52 * scale, y: headers.y,
        width: columnWidth + 40 * scale, height: field.y + field.height - headers.y,
      };
  nodes.push(vectorNode({
    nodeId: 'comparison-after-field', parentId: 'region-comparison-field',
    compositionRegionId: 'comparison-field', visualRole: 'comparison-field',
    shape: 'rect', box: tonalBox, fill: plan.styleIntent.accent.softColor, zIndex: 1,
  }));
  const rule = (id: string, x: number, y: number, length: number, color: string, strokeWidth: number) =>
    vectorNode({ nodeId: id, shape: 'path', box: { x, y, width: length, height: Math.max(1, strokeWidth) },
      pathData: `M ${x} ${y} H ${x + length}`, stroke: color, strokeWidth, zIndex: 2 });
  nodes.push(rule('comparison-after-rule', tonalBox.x, headers.y, tonalBox.width, plan.styleIntent.accent.color, 4 * scale));
  nodes.push(rule(
    'comparison-before-rule',
    guidedBeforeHeader?.x ?? field.x,
    headers.y,
    guidedBeforeHeader?.width ?? columnWidth,
    plan.styleIntent.motif.color,
    plan.styleIntent.motif.strokeWidth,
  ));
  const pairRegions = plan.regions
    .filter((region) => region.parentRegionId === 'comparison-field' && /^comparison-pair-\d+$/u.test(region.regionId))
    .sort((a, b) => a.order - b.order);
  for (const [index, region] of pairRegions.entries()) {
    const box = requiredBox(region.regionId);
    if (index < pairRegions.length - 1) {
      const beforeBox = teacherGuided ? requiredBox(`${region.regionId}-before`) : undefined;
      const afterBox = teacherGuided ? requiredBox(`${region.regionId}-after`) : undefined;
      nodes.push(rule(
        `comparison-row-left-${index}`,
        beforeBox ? beforeBox.x + 32 * scale : leftX,
        box.y + box.height,
        beforeBox ? beforeBox.width - 64 * scale : textWidth,
        plan.styleIntent.motif.color,
        revision?.strengthenGrouping ? 1.4 * scale : 1,
      ));
      nodes.push(rule(
        `comparison-row-right-${index}`,
        afterBox ? afterBox.x + 32 * scale : rightX,
        box.y + box.height,
        afterBox ? afterBox.width - 64 * scale : textWidth,
        plan.styleIntent.motif.color,
        revision?.strengthenGrouping ? 1.4 * scale : 1,
      ));
    }
  }
  for (const binding of [...plan.bindings].sort((a, b) => a.readingOrder - b.readingOrder)) {
    const box = requiredBox(binding.regionId);
    const ref = content(input, binding);
    const role = binding.fragmentRole;
    const isBefore = role === 'comparison.before' || role === 'comparison.before-label';
    const isAfter = role === 'comparison.after' || role === 'comparison.after-label';
    const isTitle = role === 'comparison.title';
    const isMessage = role === 'comparison.message';
    const x = teacherGuided && (isBefore || isAfter)
      ? box.x + 32 * scale
      : isBefore ? leftX : isAfter ? rightX : isMessage ? bounds.x + 264 * scale : bounds.x;
    const availableWidth = teacherGuided && (isBefore || isAfter)
      ? box.width - 64 * scale
      : isBefore || isAfter ? textWidth : isMessage ? bounds.width - 264 * scale : bounds.width;
    const lines = wrappedMeasures(ref, binding, availableWidth, input.measures);
    const first = lines[0]!;
    const lineHeight = first.size * 1.4;
    const textHeight = first.actualBoundingBoxAscent + lines.at(-1)!.actualBoundingBoxDescent + (lines.length - 1) * lineHeight;
    if (textHeight + 24 * scale > box.height) throw new Error('Comparison content exceeds allocated region height.');
    const top = isTitle ? box.y + 8 * scale
      : isMessage || role === 'comparison.message-label' ? box.y + 10 * scale
      : box.y + (box.height - textHeight) / 2;
    const baseline = top + first.actualBoundingBoxAscent;
    const visualRole = isTitle ? 'page-title' : isMessage ? 'message-context'
      : role === 'comparison.before' ? 'comparison-before'
      : role === 'comparison.after' ? 'comparison-after' : 'comparison-header';
    nodes.push({
      nodeId: `comparison-text-${binding.blockId}`, kind: 'text', parentId: `region-${binding.regionId}`,
      semanticBlockId: binding.blockId, compositionRegionId: binding.regionId, visualRole,
      zIndex: 5, box: { x: x - 4, y: top - 4, width: Math.max(...lines.map((line) => line.width)) + 8, height: textHeight + 8 },
      visible: true, clip: false, text: ref.text, sourceSpanIds: ref.sourceSpanIds,
      sourceTransform: ref.transform, sourceUsage: 'content',
      font: { family: first.family, fileHash: fontHashForWeight(input.fonts, first.weight),
        size: first.size, weight: first.weight, lineHeight, letterSpacing: first.letterSpacing },
      color: isAfter ? plan.styleIntent.accent.color : isBefore || role === 'comparison.message-label'
        ? plan.styleIntent.palette.mutedInk : plan.styleIntent.palette.ink,
      align: 'start',
      lines: lines.map((line, index) => ({ text: line.text, x, baselineY: baseline + index * lineHeight, advanceWidth: line.width })),
    });
  }
  // The pair region comes from Composition; each edge must agree with its two bound endpoints.
  for (const relation of input.slide.relations) {
    const before = plan.bindings.find((binding) => binding.blockId === relation.fromBlockId);
    const after = plan.bindings.find((binding) => binding.blockId === relation.toBlockId);
    const beforeRegion = before ? plan.regions.find((region) => region.regionId === before.regionId) : undefined;
    const afterRegion = after ? plan.regions.find((region) => region.regionId === after.regionId) : undefined;
    const pairRegionId = teacherGuided ? beforeRegion?.parentRegionId : before?.regionId;
    const changeRegionId = teacherGuided && pairRegionId !== undefined ? `${pairRegionId}-change` : undefined;
    const pairMatches = teacherGuided
      ? pairRegionId !== undefined && pairRegionId === afterRegion?.parentRegionId
        && plan.regions.some((region) => region.regionId === changeRegionId && region.parentRegionId === pairRegionId)
      : before?.regionId === after?.regionId;
    if (relation.type !== 'compares-with' || !before || !after || !pairMatches
      || before.fragmentRole !== 'comparison.before' || after.fragmentRole !== 'comparison.after'
      || pairRegionId === undefined) {
      throw new Error('Composition pairing does not match the authored comparison relation.');
    }
    const box = requiredBox(pairRegionId);
    const changeBox = teacherGuided && changeRegionId ? requiredBox(changeRegionId) : undefined;
    const arrowLength = revision?.strengthenRelation ? 72 * scale : 40 * scale;
    const arrowHead = revision?.strengthenRelation ? 10 * scale : 7 * scale;
    const x = changeBox
      ? changeBox.x + (changeBox.width - arrowLength) / 2
      : field.x + columnWidth + gap / 2 - arrowLength / 2;
    const cy = box.y + box.height / 2;
    nodes.push(vectorNode({
      nodeId: `comparison-change-${relation.id}`, parentId: `region-${changeRegionId ?? pairRegionId}`,
      relationId: relation.id, relationVisualRole: 'comparison-change', visualRole: 'relation-carrier',
      compositionRegionId: changeRegionId ?? pairRegionId, shape: 'path',
      box: { x, y: cy - arrowHead, width: arrowLength, height: arrowHead * 2 },
      pathData: `M ${x} ${cy} H ${x + arrowLength} M ${x + arrowLength - arrowHead} ${cy - arrowHead} L ${x + arrowLength} ${cy} L ${x + arrowLength - arrowHead} ${cy + arrowHead}`,
      stroke: plan.styleIntent.palette.connector,
      strokeWidth: revision?.strengthenRelation ? 2.2 * scale : 1.6 * scale,
    }));
  }
  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: `render-${plan.planId}${revision === undefined ? '' : `-${revision.revisionId}`}`,
    compositionPlanId: plan.planId,
    slideId: input.slide.slideId, pageProfile: plan.pageProfile, layoutFamily: plan.layout.layoutFamily,
    background: plan.styleIntent.palette.background, nodes,
    deterministicFingerprint: contentHash({
      slide: input.slide,
      plan,
      nodes,
      fonts: input.fonts.map((font) => font.fileHash),
      version: 'aligned-feature-spec-v1',
      presentationRevision: revision ?? null,
    }),
  });
}
