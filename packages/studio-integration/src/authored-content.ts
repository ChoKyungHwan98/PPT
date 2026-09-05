import { contentHash, type SourceSegment } from '@game-presentation/contracts';
import type { AuthoredFeatureComparison } from '../../source-ingestion/src/authored-feature-comparison.js';
import type { AuthoredHierarchy } from '../../source-ingestion/src/authored-hierarchy.js';

function meaningfulLines(text: string) {
  return text.replaceAll('\r\n', '\n').split('\n').map((raw) => ({ raw, text: raw.trim() })).filter((line) => line.text !== '');
}

function value(line: string, label: string): string | undefined {
  const match = line.match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'u'));
  return match?.[1]?.trim();
}

export function parseAuthoredComparison(authoredContent: string): AuthoredFeatureComparison {
  const lines = meaningfulLines(authoredContent);
  const title = value(lines[0]?.text ?? '', '제목') ?? lines[0]?.text;
  const beforeIndex = lines.findIndex((line) => /^기존(?:\s|$|[:：])/u.test(line.text));
  const afterIndex = lines.findIndex((line) => /^개선(?:\s|$|[:：])/u.test(line.text));
  const messageIndex = lines.findIndex((line) => /^메시지\s*[:：]/u.test(line.text));
  if (!title || beforeIndex < 0 || afterIndex <= beforeIndex || messageIndex <= afterIndex) throw new Error('전후 비교 원고에는 제목, 기존, 개선, 메시지가 필요합니다.');
  const cleanItem = (text: string) => text.replace(/^[-•]\s*/u, '').trim();
  const beforeLabel = lines[beforeIndex]!.text.replace(/[:：]$/u, '');
  const afterLabel = lines[afterIndex]!.text.replace(/[:：]$/u, '');
  const beforeItems = lines.slice(beforeIndex + 1, afterIndex).map((line) => cleanItem(line.text)).filter(Boolean);
  const afterItems = lines.slice(afterIndex + 1, messageIndex).map((line) => cleanItem(line.text)).filter(Boolean);
  const message = value(lines[messageIndex]!.text, '메시지');
  if (!message || beforeItems.length === 0 || beforeItems.length !== afterItems.length) throw new Error('기존/개선 항목은 같은 개수로 한 개 이상 작성해야 합니다.');
  const entries = [title, beforeLabel, ...beforeItems, afterLabel, ...afterItems, message];
  const ids = entries.map((_, index) => `source-${index + 1}`);
  const segments: SourceSegment[] = entries.map((text, index) => ({ id: ids[index]!, text }));
  const beforeIds = ids.slice(2, 2 + beforeItems.length);
  const afterLabelIndex = 2 + beforeItems.length;
  const afterIds = ids.slice(afterLabelIndex + 1, afterLabelIndex + 1 + afterItems.length);
  return {
    fixtureId: `studio-comparison-${contentHash(authoredContent).slice(0, 12)}`, rawText: authoredContent, segments,
    titleSegmentId: ids[0]!, messageSegmentId: ids.at(-1)!,
    before: { labelSegmentId: ids[1]!, itemSegmentIds: beforeIds },
    after: { labelSegmentId: ids[afterLabelIndex]!, itemSegmentIds: afterIds },
    pairs: beforeIds.map((beforeSegmentId, index) => ({ beforeSegmentId, afterSegmentId: afterIds[index]! })),
  };
}

export function parseAuthoredHierarchy(authoredContent: string): AuthoredHierarchy {
  const all = authoredContent.replaceAll('\r\n', '\n').split('\n');
  const titleLine = all.find((line) => /^제목\s*[:：]/u.test(line.trim()));
  const messageLine = all.find((line) => /^메시지\s*[:：]/u.test(line.trim()));
  const structureIndex = all.findIndex((line) => /^구조\s*[:：]?\s*$/u.test(line.trim()));
  const title = titleLine ? value(titleLine.trim(), '제목') : undefined;
  const message = messageLine ? value(messageLine.trim(), '메시지') : undefined;
  if (!title || !message || structureIndex < 0) throw new Error('역할 구조 원고에는 제목, 메시지, 구조가 필요합니다.');
  const nodeLines = all.slice(structureIndex + 1).filter((line) => line.trim() !== '').map((line) => ({ indent: line.match(/^\s*/u)?.[0].replaceAll('\t', '  ').length ?? 0, text: line.trim().replace(/^[-•]\s*/u, '') }));
  if (nodeLines.length === 0) throw new Error('구조에는 최소 한 개의 역할이 필요합니다.');
  const segments: SourceSegment[] = [{ id: 'title', text: title }, { id: 'message', text: message }];
  const stack: Array<{ indent: number; segmentId: string }> = [];
  const nodes = nodeLines.map((node, index) => {
    const segmentId = `node-${index + 1}`;
    segments.push({ id: segmentId, text: node.text });
    while (stack.length > 0 && stack.at(-1)!.indent >= node.indent) stack.pop();
    const parentSegmentId = stack.at(-1)?.segmentId;
    stack.push({ indent: node.indent, segmentId });
    return { segmentId, ...(parentSegmentId === undefined ? {} : { parentSegmentId }) };
  });
  return { fixtureId: `studio-hierarchy-${contentHash(authoredContent).slice(0, 12)}`, rawText: authoredContent, segments, titleSegmentId: 'title', messageSegmentId: 'message', facets: ['content'], nodes };
}
