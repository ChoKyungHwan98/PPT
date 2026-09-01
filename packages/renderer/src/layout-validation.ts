import { FindingSchema, type Finding, type RenderNode, type RenderTree } from '@game-presentation/contracts';

type Box = RenderNode['box'];

function intersects(left: Box, right: Box): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function contains(box: Box, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

function rgb(hex: string): [number, number, number] {
  const value = hex.slice(1, 7);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function blend(foreground: string, background: string, opacity: number): string {
  const fg = rgb(foreground);
  const bg = rgb(background);
  const channels = fg.map((channel, index) =>
    Math.round(channel * opacity + (bg[index] ?? 0) * (1 - opacity)),
  );
  return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

function luminance(hex: string): number {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrastRatio(foreground: string, background: string): number {
  const high = Math.max(luminance(foreground), luminance(background));
  const low = Math.min(luminance(foreground), luminance(background));
  return (high + 0.05) / (low + 0.05);
}

function backgroundUnderText(tree: RenderTree, textNode: Extract<RenderNode, { kind: 'text' }>): string {
  const centerX = textNode.box.x + textNode.box.width / 2;
  const centerY = textNode.box.y + textNode.box.height / 2;
  const candidates = tree.nodes
    .filter(
      (node): node is Extract<RenderNode, { kind: 'shape' }> =>
        node.kind === 'shape' &&
        node.visible &&
        node.zIndex < textNode.zIndex &&
        node.paint.fill !== undefined &&
        contains(node.box, centerX, centerY),
    )
    .sort((left, right) => left.zIndex - right.zIndex);
  return candidates.reduce(
    (background, node) => blend(node.paint.fill ?? background, background, node.paint.opacity ?? 1),
    tree.background,
  );
}

export function validateLayout(tree: RenderTree): Finding[] {
  const findings: Finding[] = [];
  const add = (finding: Omit<Finding, 'schemaVersion'>): void => {
    findings.push(FindingSchema.parse({ schemaVersion: '0.1', ...finding }));
  };
  const textNodes = tree.nodes.filter(
    (node): node is Extract<RenderNode, { kind: 'text' }> => node.kind === 'text' && node.visible,
  );

  for (const node of textNodes) {
    for (const line of node.lines) {
      const left =
        node.align === 'center'
          ? line.x - line.advanceWidth / 2
          : node.align === 'end'
            ? line.x - line.advanceWidth
            : line.x;
      const right = left + line.advanceWidth;
      const tolerance = 1;
      if (left < node.box.x - tolerance || right > node.box.x + node.box.width + tolerance) {
        add({
          findingId: 'text-overflow-' + node.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'layout',
          severity: 'error',
          code: 'text-overflow',
          nodeIds: [node.nodeId],
          message: '측정된 텍스트가 할당된 상자보다 넓습니다.',
          evidence: { line: line.text, left, right, box: node.box },
        });
      }
      if (line.baselineY < node.box.y || line.baselineY > node.box.y + node.box.height) {
        add({
          findingId: 'text-baseline-' + node.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'layout',
          severity: 'error',
          code: 'text-overflow',
          nodeIds: [node.nodeId],
          message: '텍스트 baseline이 할당된 상자를 벗어났습니다.',
          evidence: { baselineY: line.baselineY, box: node.box },
        });
      }
    }

    const background = backgroundUnderText(tree, node);
    const ratio = contrastRatio(node.color, background);
    const largeText = node.font.size >= 24 || (node.font.size >= 18.66 && node.font.weight >= 700);
    const threshold = largeText ? 3 : 4.5;
    if (ratio < threshold) {
      add({
        findingId: 'contrast-' + node.nodeId,
        artifactId: tree.renderTreeId,
        stage: 'layout',
        severity: 'error',
        code: 'low-contrast',
        nodeIds: [node.nodeId],
        message: '텍스트 대비가 읽기 기준보다 낮습니다.',
        evidence: { foreground: node.color, background, ratio, threshold },
      });
    }
  }

  for (let leftIndex = 0; leftIndex < textNodes.length; leftIndex += 1) {
    const left = textNodes[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < textNodes.length; rightIndex += 1) {
      const right = textNodes[rightIndex]!;
      if (
        left.semanticBlockId !== undefined &&
        left.semanticBlockId === right.semanticBlockId
      ) {
        continue;
      }
      if (intersects(left.box, right.box)) {
        add({
          findingId: 'collision-' + left.nodeId + '-' + right.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'layout',
          severity: 'error',
          code: 'collision',
          nodeIds: [left.nodeId, right.nodeId],
          message: '서로 다른 내용의 텍스트 상자가 겹칩니다.',
          evidence: { left: left.box, right: right.box },
        });
        continue;
      }
      const verticalOverlap =
        left.box.y < right.box.y + right.box.height &&
        left.box.y + left.box.height > right.box.y;
      const horizontalGap =
        Math.max(left.box.x, right.box.x) -
        Math.min(left.box.x + left.box.width, right.box.x + right.box.width);
      if (verticalOverlap && horizontalGap >= 0 && horizontalGap < 24) {
        add({
          findingId: 'proximity-' + left.nodeId + '-' + right.nodeId,
          artifactId: tree.renderTreeId,
          stage: 'layout',
          severity: 'error',
          code: 'collision',
          nodeIds: [left.nodeId, right.nodeId],
          message: '서로 다른 내용의 텍스트 사이 간격이 너무 좁습니다.',
          evidence: { horizontalGap, minimumGap: 24, left: left.box, right: right.box },
        });
      }
    }
  }
  return findings;
}
