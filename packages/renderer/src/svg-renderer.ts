import type { RenderNode, RenderTree } from '@game-presentation/contracts';
import { contentHash } from '@game-presentation/contracts';
import { fontFaceCss, type FontAsset } from './font.js';

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function attributes(values: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ' ' + key + '=\"' + escapeText(String(value)) + '\"')
    .join('');
}

function renderNode(node: RenderNode): string {
  if (!node.visible) return '';
  const common = {
    id: node.nodeId,
    'data-semantic-block-id': node.semanticBlockId,
    'data-relation-id': node.relationId,
    opacity: 1,
  };

  if (node.kind === 'group') {
    return '<g' + attributes(common) + '></g>';
  }

  if (node.kind === 'text') {
    const anchor = node.align === 'center' ? 'middle' : node.align === 'end' ? 'end' : 'start';
    const lines = node.lines
      .map(
        (line) =>
          '<tspan' +
          attributes({ x: line.x, y: line.baselineY, 'data-advance-width': line.advanceWidth }) +
          '>' +
          escapeText(line.text) +
          '</tspan>',
      )
      .join('');
    return (
      '<text' +
      attributes({
        ...common,
        'font-family': node.font.family,
        'font-size': node.font.size,
        'font-weight': node.font.weight,
        'letter-spacing': node.font.letterSpacing,
        fill: node.color,
        'text-anchor': anchor,
      }) +
      '>' +
      lines +
      '</text>'
    );
  }

  if (node.kind === 'image') {
    return (
      '<image' +
      attributes({
        ...common,
        x: node.box.x,
        y: node.box.y,
        width: node.box.width,
        height: node.box.height,
        opacity: node.opacity,
        'data-asset-id': node.assetId,
      }) +
      '/>'
    );
  }

  const paint = {
    fill: node.paint.fill ?? 'none',
    stroke: node.paint.stroke ?? 'none',
    'stroke-width': node.paint.strokeWidth,
    opacity: node.paint.opacity,
    'vector-effect': 'non-scaling-stroke',
  };
  if (node.shape === 'rect') {
    return '<rect' + attributes({ ...common, ...paint, x: node.box.x, y: node.box.y, width: node.box.width, height: node.box.height }) + '/>';
  }
  if (node.shape === 'round-rect') {
    const radius = Math.min(node.box.width, node.box.height) * 0.08;
    return '<rect' + attributes({ ...common, ...paint, x: node.box.x, y: node.box.y, width: node.box.width, height: node.box.height, rx: radius, ry: radius }) + '/>';
  }
  if (node.shape === 'ellipse') {
    return '<ellipse' + attributes({ ...common, ...paint, cx: node.box.x + node.box.width / 2, cy: node.box.y + node.box.height / 2, rx: node.box.width / 2, ry: node.box.height / 2 }) + '/>';
  }
  if (node.shape === 'line') {
    return '<line' + attributes({ ...common, ...paint, x1: node.box.x, y1: node.box.y, x2: node.box.x + node.box.width, y2: node.box.y + node.box.height }) + '/>';
  }
  return '<path' + attributes({ ...common, ...paint, d: node.pathData ?? '' }) + '/>';
}

export function renderTreeToSvg(tree: RenderTree, fonts: FontAsset[]): string {
  const nodes = [...tree.nodes].sort((left, right) => left.zIndex - right.zIndex).map(renderNode).join('');
  return (
    '<svg xmlns=\"http://www.w3.org/2000/svg\"' +
    attributes({
      width: tree.pageProfile.width,
      height: tree.pageProfile.height,
      viewBox: '0 0 ' + String(tree.pageProfile.width) + ' ' + String(tree.pageProfile.height),
      role: 'img',
      'aria-label': tree.slideId,
      'data-render-tree-id': tree.renderTreeId,
    }) +
    '><style>' +
    fonts.map(fontFaceCss).join('') +
    'text{font-kerning:normal;text-rendering:geometricPrecision}*{shape-rendering:geometricPrecision}' +
    '</style><rect width=\"100%\" height=\"100%\" fill=\"' +
    tree.background +
    '\"/>' +
    nodes +
    '</svg>'
  );
}

export function renderTreeToHtml(tree: RenderTree, fonts: FontAsset[]): string {
  const svg = renderTreeToSvg(tree, fonts);
  const width = tree.pageProfile.width;
  const height = tree.pageProfile.height;
  const pageHash = contentHash({ tree, fontHashes: fonts.map((font) => font.fileHash) });
  return (
    '<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">' +
    '<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">' +
    '<title>' +
    escapeText(tree.slideId) +
    '</title><style>' +
    '@page{size:' +
    String(width / 96) +
    'in ' +
    String(height / 96) +
    'in;margin:0}' +
    'html,body{margin:0;width:' +
    String(width) +
    'px;height:' +
    String(height) +
    'px;overflow:hidden;background:' +
    tree.background +
    '}svg{display:block;width:' +
    String(width) +
    'px;height:' +
    String(height) +
    'px}@media print{html,body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}' +
    '</style></head><body data-page-hash=\"' +
    pageHash +
    '\">' +
    svg +
    '</body></html>'
  );
}
