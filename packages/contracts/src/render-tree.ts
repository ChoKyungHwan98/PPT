import { z } from 'zod';
import { FindingSchema, type Finding } from './finding.js';
import { PageProfileSchema } from './composition.js';
import type { SlideIR } from './slide-ir.js';

const BoxSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const PaintSchema = z.strictObject({
  fill: z.string().regex(/^#[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?$/).optional(),
  stroke: z.string().regex(/^#[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?$/).optional(),
  strokeWidth: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const NodeBaseShape = {
  nodeId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  semanticBlockId: z.string().min(1).optional(),
  relationId: z.string().min(1).optional(),
  zIndex: z.number().int(),
  box: BoxSchema,
  clip: z.boolean(),
  visible: z.boolean(),
};

const GroupNodeSchema = z.strictObject({
  ...NodeBaseShape,
  kind: z.literal('group'),
});

const ShapeNodeSchema = z.strictObject({
  ...NodeBaseShape,
  kind: z.literal('shape'),
  shape: z.enum(['rect', 'round-rect', 'ellipse', 'line', 'polygon', 'path']),
  paint: PaintSchema,
  pathData: z.string().min(1).optional(),
});

const TextLineSchema = z.strictObject({
  text: z.string(),
  x: z.number().finite(),
  baselineY: z.number().finite(),
  advanceWidth: z.number().nonnegative(),
});

const TextNodeSchema = z.strictObject({
  ...NodeBaseShape,
  kind: z.literal('text'),
  text: z.string().min(1),
  sourceSpanIds: z.array(z.string().min(1)).min(1),
  sourceTransform: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('exact') }),
    z.strictObject({ kind: z.literal('join'), separator: z.string() }),
  ]),
  font: z.strictObject({
    family: z.string().min(1),
    fileHash: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().positive(),
    weight: z.number().int().min(100).max(900),
    lineHeight: z.number().positive(),
    letterSpacing: z.number().finite(),
  }),
  color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
  align: z.enum(['start', 'center', 'end']),
  lines: z.array(TextLineSchema).min(1),
});

const ImageNodeSchema = z.strictObject({
  ...NodeBaseShape,
  kind: z.literal('image'),
  assetId: z.string().min(1),
  assetHash: z.string().regex(/^[a-f0-9]{64}$/),
  fit: z.enum(['contain', 'cover', 'fill']),
  opacity: z.number().min(0).max(1),
});

export const RenderNodeSchema = z.discriminatedUnion('kind', [
  GroupNodeSchema,
  ShapeNodeSchema,
  TextNodeSchema,
  ImageNodeSchema,
]);

export type RenderNode = z.infer<typeof RenderNodeSchema>;

export const RenderTreeSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    renderTreeId: z.string().min(1),
    compositionPlanId: z.string().min(1),
    slideId: z.string().min(1),
    pageProfile: PageProfileSchema,
    background: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
    nodes: z.array(RenderNodeSchema).min(1),
    deterministicFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .superRefine((tree, context) => {
    const ids = new Set<string>();
    for (const [index, node] of tree.nodes.entries()) {
      if (ids.has(node.nodeId)) {
        context.addIssue({ code: 'custom', path: ['nodes', index, 'nodeId'], message: 'render node id가 중복됩니다.' });
      }
      ids.add(node.nodeId);
    }
    for (const [index, node] of tree.nodes.entries()) {
      if (node.parentId !== undefined && !ids.has(node.parentId)) {
        context.addIssue({ code: 'custom', path: ['nodes', index, 'parentId'], message: '부모 render node가 존재하지 않습니다.' });
      }
    }
  });

export type RenderTree = z.infer<typeof RenderTreeSchema>;

export function validateRenderTreeAgainstSlide(tree: RenderTree, slide: SlideIR): Finding[] {
  const findings: Finding[] = [];
  const spanMap = new Map(slide.source.spans.map((span) => [span.id, span]));
  const blockIds = new Set(slide.blocks.map((block) => block.id));
  const relationIds = new Set(slide.relations.map((relation) => relation.id));
  const renderedBlocks = new Set<string>();
  const renderedRelations = new Set<string>();
  const pageWidth = tree.pageProfile.width;
  const pageHeight = tree.pageProfile.height;
  const sourceCoverage = new Array<number>(slide.source.rawText.length).fill(0);

  const addFinding = (finding: Omit<Finding, 'schemaVersion'>): void => {
    findings.push(FindingSchema.parse({ schemaVersion: '0.1', ...finding }));
  };

  for (const node of tree.nodes) {
    if (node.semanticBlockId !== undefined) {
      if (blockIds.has(node.semanticBlockId)) renderedBlocks.add(node.semanticBlockId);
      else {
        addFinding({
          findingId: 'unknown-block-' + node.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'contract',
          severity: 'error',
          code: 'untraceable-content',
          nodeIds: [node.nodeId],
          message: '존재하지 않는 semantic block을 가리킵니다.',
          evidence: { semanticBlockId: node.semanticBlockId },
        });
      }
    }
    if (node.relationId !== undefined) {
      if (relationIds.has(node.relationId)) renderedRelations.add(node.relationId);
      else {
        addFinding({
          findingId: 'unknown-relation-' + node.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'contract',
          severity: 'error',
          code: 'untraceable-content',
          nodeIds: [node.nodeId],
          message: '존재하지 않는 semantic relation을 가리킵니다.',
          evidence: { relationId: node.relationId },
        });
      }
    }

    const outside =
      node.box.x < 0 ||
      node.box.y < 0 ||
      node.box.x + node.box.width > pageWidth ||
      node.box.y + node.box.height > pageHeight;
    if (outside) {
      addFinding({
        findingId: 'bounds-' + node.nodeId,
        artifactId: tree.renderTreeId,
        stage: 'layout',
        severity: 'error',
        code: 'out-of-bounds',
        nodeIds: [node.nodeId],
        message: '요소가 페이지 경계를 벗어났습니다.',
        evidence: { box: node.box, pageWidth, pageHeight },
      });
    }

    if (node.kind === 'text') {
      const spans = node.sourceSpanIds.map((id) => spanMap.get(id));
      const expected =
        node.sourceTransform.kind === 'exact'
          ? spans[0]?.text
          : spans.map((span) => span?.text ?? '').join(node.sourceTransform.separator);
      if (spans.some((span) => span === undefined) || node.text !== expected) {
        addFinding({
          findingId: 'text-source-' + node.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'contract',
          severity: 'fatal',
          code: 'untraceable-content',
          nodeIds: [node.nodeId],
          message: '표시 텍스트를 사용자 원문으로 역추적할 수 없습니다.',
          evidence: { text: node.text, sourceSpanIds: node.sourceSpanIds },
        });
      } else {
        const coveredByNode = new Set<number>();
        for (const span of spans) {
          if (span === undefined) continue;
          for (let offset = span.start; offset < span.end; offset += 1) {
            if (!/\s/u.test(slide.source.rawText[offset] ?? '')) coveredByNode.add(offset);
          }
        }
        for (const offset of coveredByNode) {
          sourceCoverage[offset] = (sourceCoverage[offset] ?? 0) + 1;
        }
      }
    }
  }

  for (const spanId of slide.constraints.lockedSpanIds) {
    const span = slide.source.spans.find((candidate) => candidate.id === spanId);
    if (span === undefined) continue;
    const meaningfulOffsets = Array.from(
      { length: span.end - span.start },
      (_, index) => span.start + index,
    ).filter((offset) => !/\s/u.test(slide.source.rawText[offset] ?? ''));
    const missingOffsets = meaningfulOffsets.filter((offset) => (sourceCoverage[offset] ?? 0) === 0);
    const duplicatedOffsets = meaningfulOffsets.filter((offset) => (sourceCoverage[offset] ?? 0) > 1);
    if (missingOffsets.length > 0) {
      addFinding({
        findingId: 'missing-source-content-' + spanId,
        artifactId: tree.renderTreeId,
        stage: 'contract',
        severity: 'error',
        code: 'missing-source-content',
        nodeIds: [],
        message: '잠근 원문 내용이 렌더 결과에 정확히 표시되지 않았습니다.',
        evidence: { spanId, text: span.text, missingCharacterCount: missingOffsets.length },
      });
    }
    if (duplicatedOffsets.length > 0) {
      addFinding({
        findingId: 'duplicate-content-' + spanId,
        artifactId: tree.renderTreeId,
        stage: 'contract',
        severity: 'error',
        code: 'duplicate-content',
        nodeIds: tree.nodes
          .filter((node) => node.kind === 'text' && node.sourceSpanIds.some((id) => id === spanId || id === 'source-all'))
          .map((node) => node.nodeId),
        message: '같은 잠근 원문 내용이 렌더 결과에 중복 표시되었습니다.',
        evidence: { spanId, text: span.text, duplicatedCharacterCount: duplicatedOffsets.length },
      });
    }
  }

  for (const blockId of blockIds) {
    if (!renderedBlocks.has(blockId)) {
      addFinding({
        findingId: 'missing-block-' + blockId,
        artifactId: tree.renderTreeId,
        stage: 'contract',
        severity: 'error',
        code: 'missing-block',
        nodeIds: [],
        message: '렌더 결과에 빠진 semantic block이 있습니다.',
        evidence: { blockId },
      });
    }
  }
  for (const relationId of relationIds) {
    if (!renderedRelations.has(relationId)) {
      addFinding({
        findingId: 'missing-relation-' + relationId,
        artifactId: tree.renderTreeId,
        stage: 'contract',
        severity: 'error',
        code: 'missing-relation',
        nodeIds: [],
        message: '렌더 결과에 빠진 semantic relation이 있습니다.',
        evidence: { relationId },
      });
    }
  }
  return findings;
}
