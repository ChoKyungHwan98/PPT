import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { RenderTreeSchema } from '@game-presentation/contracts';
import { createMec01InformationPlan, interpretMec01Source } from '../../source-ingestion/src/mec-01-semantic.js';
import { runHardGate } from '../src/hard-gate.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const tree = RenderTreeSchema.parse(JSON.parse(await readFile(
  new URL('../fixtures/mec-01-accumulation-threshold-consequence.render-tree.json', import.meta.url),
  'utf8',
)));
const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
const informationPlan = createMec01InformationPlan(slide);

function textByRole(role: NonNullable<typeof tree.nodes[number]['visualRole']>) {
  return tree.nodes.filter(
    (node): node is Extract<typeof tree.nodes[number], { kind: 'text' }> =>
      node.kind === 'text' && node.visualRole === role,
  );
}

describe('MEC-01 production-measured RenderTree proof artifact', () => {
  it('stores a non-empty 1920x1080 production renderer PNG', async () => {
    const pngUrl = new URL('../fixtures/mec-01-accumulation-threshold-consequence.png', import.meta.url);
    const [bytes, file] = await Promise.all([readFile(pngUrl), stat(pngUrl)]);
    const metadata = await sharp(bytes).metadata();
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
    expect(file.size).toBeGreaterThan(0);
  });

  it('suppresses the duplicate message and preserves the three semantic phases', () => {
    expect(tree.messagePresentation?.presentationKind).toBe('suppressed-duplicate');
    expect(textByRole('message-context')).toHaveLength(0);
    expect(textByRole('ordered-step').map((node) => node.text)).toEqual([
      '회피 ×3',
      '시간 파편 획득',
      '시간 정지 5초',
    ]);
    expect(textByRole('threshold-event').map((node) => node.text)).toEqual(['BREAK']);
    expect(textByRole('consequence-result').map((node) => node.text)).toEqual([
      '받는 피해',
      '+50%',
    ]);
  });

  it('maps each authored relation to exactly one visible semantic carrier', () => {
    const expected = new Map([
      ['r-dodge-fragment', 'accumulation-local'],
      ['r-fragment-freeze', 'accumulation-local'],
      ['r-freeze-break', 'threshold-entry'],
      ['r-break-damage', 'consequence-activation'],
    ]);
    for (const [relationId, relationVisualRole] of expected) {
      const carriers = tree.nodes.filter((node) =>
        node.visible && node.relationId === relationId && node.visualRole === 'relation-carrier',
      );
      expect(carriers).toHaveLength(1);
      expect(carriers[0]?.relationVisualRole).toBe(relationVisualRole);
    }
    expect(slide.relations.some((relation) =>
      relation.fromBlockId === 'freeze-step' && relation.toBlockId === 'damage-modifier',
    )).toBe(false);
  });

  it('contains no legacy fallback nodes and passes the complete Hard Gate', () => {
    expect(tree.nodes.some((node) =>
      ['motif-', 'connector-marker-', 'phase-placeholder-relation-'].some((prefix) =>
        node.nodeId.startsWith(prefix),
      ),
    )).toBe(false);
    expect(tree.nodes.some((node) => slide.relations.some((relation) =>
      node.nodeId === `relation-${relation.id}`,
    ))).toBe(false);
    expect(tree.nodes.some((node) =>
      node.kind === 'shape' && (node.shape === 'rect' || node.shape === 'round-rect'),
    )).toBe(false);
    expect(runHardGate({ slide, informationPlan, tree })).toEqual({
      passed: true,
      programFindings: [],
      sourceFidelityFindings: [],
      findings: [],
    });
  });

  it('records the intended numeric hierarchy and in-bounds semantic regions', () => {
    const accumulationSizes = textByRole('ordered-step').map((node) => node.font.size);
    const thresholdSizes = textByRole('threshold-event').map((node) => node.font.size);
    const consequenceSizes = textByRole('consequence-result').map((node) => node.font.size);
    expect(Math.min(...thresholdSizes)).toBeGreaterThan(Math.max(...consequenceSizes));
    expect(Math.min(...consequenceSizes)).toBeGreaterThan(Math.max(...accumulationSizes));
    for (const regionId of ['phase-accumulation', 'phase-threshold', 'phase-consequence']) {
      const region = tree.nodes.find((node) => node.nodeId === `region-${regionId}`);
      expect(region).toBeDefined();
      expect(region!.box.x).toBeGreaterThanOrEqual(0);
      expect(region!.box.y).toBeGreaterThanOrEqual(0);
      expect(region!.box.x + region!.box.width).toBeLessThanOrEqual(tree.pageProfile.width);
      expect(region!.box.y + region!.box.height).toBeLessThanOrEqual(tree.pageProfile.height);
    }
  });
});
