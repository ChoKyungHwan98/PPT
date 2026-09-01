import { describe, expect, it } from 'vitest';
import { RenderTreeSchema } from '@game-presentation/contracts';
import { PAGE_PROFILES } from '@game-presentation/contracts';
import { validateLayout } from '../src/layout-validation.js';

const fontHash = 'a'.repeat(64);

function treeWithText(input: {
  boxWidth?: number;
  lineWidth?: number;
  color?: string;
  secondX?: number;
}) {
  const baseText = {
    kind: 'text' as const,
    zIndex: 2,
    box: { x: 100, y: 100, width: input.boxWidth ?? 200, height: 60 },
    clip: false,
    visible: true,
    text: 'BREAK',
    sourceSpanIds: ['break'],
    sourceTransform: { kind: 'exact' as const },
    font: {
      family: 'Pretendard',
      fileHash: fontHash,
      size: 40,
      weight: 700,
      lineHeight: 48,
      letterSpacing: 0,
    },
    color: input.color ?? '#FFFFFF',
    align: 'start' as const,
    lines: [{ text: 'BREAK', x: 100, baselineY: 140, advanceWidth: input.lineWidth ?? 120 }],
  };
  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: 'tree',
    compositionPlanId: 'plan',
    slideId: 'slide',
    pageProfile: PAGE_PROFILES.pdfPresentation,
    background: '#0A2030',
    deterministicFingerprint: 'b'.repeat(64),
    nodes: [
      { ...baseText, nodeId: 'first', semanticBlockId: 'first-block' },
      ...(input.secondX === undefined
        ? []
        : [
            {
              ...baseText,
              nodeId: 'second',
              semanticBlockId: 'second-block',
              box: { ...baseText.box, x: input.secondX },
              lines: [{ ...baseText.lines[0]!, x: input.secondX }],
            },
          ]),
    ],
  });
}

describe('layout validation', () => {
  it('reports measured text overflow', () => {
    const findings = validateLayout(treeWithText({ boxWidth: 80, lineWidth: 120 }));
    expect(findings.some((finding) => finding.code === 'text-overflow')).toBe(true);
  });

  it('reports text collisions across semantic objects', () => {
    const findings = validateLayout(treeWithText({ secondX: 180 }));
    expect(findings.some((finding) => finding.code === 'collision')).toBe(true);
  });

  it('reports text boxes that nearly touch', () => {
    const findings = validateLayout(treeWithText({ secondX: 322 }));
    expect(findings.some((finding) => finding.code === 'collision')).toBe(true);
  });

  it('reports low contrast text', () => {
    const findings = validateLayout(treeWithText({ color: '#183244' }));
    expect(findings.some((finding) => finding.code === 'low-contrast')).toBe(true);
  });

  it('accepts readable, separated text', () => {
    expect(validateLayout(treeWithText({}))).toEqual([]);
  });
});
