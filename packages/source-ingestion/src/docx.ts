import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AuthoredDocumentSchema,
  ContentInventorySchema,
  sha256Bytes,
  type AuthoredBlock,
  type AuthoredDocument,
  type AuthoredSection,
  type ContentInventory,
} from '@game-presentation/contracts';
import { XMLParser } from 'fast-xml-parser';
import { strFromU8, unzipSync } from 'fflate';

const orderedXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  textNodeName: '#text',
});

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function collectText(value: unknown): string {
  if (Array.isArray(value)) return value.map(collectText).join('');
  if (value === null || typeof value !== 'object') return '';
  let output = '';
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === '#text') output += String(child);
    else if (key === 'w:tab') output += '\t';
    else if (key === 'w:br' || key === 'w:cr') output += '\n';
    else output += collectText(child);
  }
  return output;
}

function textFromXml(fragment: string): string {
  return collectText(orderedXmlParser.parse(fragment)).replace(/\s+\n/g, '\n').trim();
}

function buildStyleMap(stylesXml: string | undefined): ReadonlyMap<string, string> {
  const styles = new Map<string, string>();
  if (stylesXml === undefined) return styles;
  const stylePattern = /<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g;
  for (const match of stylesXml.matchAll(stylePattern)) {
    const styleId = match[1];
    const body = match[2];
    if (styleId === undefined || body === undefined) continue;
    const name = /<w:name\b[^>]*w:val="([^"]+)"/.exec(body)?.[1];
    styles.set(styleId, decodeXmlEntities(name ?? styleId));
  }
  return styles;
}

function headingLevel(styleId: string, styleName: string): number | undefined {
  const normalized = `${styleId} ${styleName}`.toLowerCase().replaceAll('_', ' ');
  const match = /(?:heading|제목)\s*([1-9])/.exec(normalized);
  const level = match?.[1] === undefined ? undefined : Number(match[1]);
  return Number.isInteger(level) ? level : undefined;
}

function parseParagraph(fragment: string, index: number, styles: ReadonlyMap<string, string>): AuthoredBlock | undefined {
  const text = textFromXml(fragment);
  if (text.length === 0) return undefined;
  const styleId = /<w:pStyle\b[^>]*w:val="([^"]+)"/.exec(fragment)?.[1] ?? '';
  const styleName = styles.get(styleId) ?? styleId;
  const level = headingLevel(styleId, styleName);
  return {
    id: `p-${String(index).padStart(4, '0')}`,
    kind: 'paragraph',
    order: index,
    text,
    styleId,
    styleName,
    ...(level === undefined ? {} : { headingLevel: level }),
  };
}

function parseTable(fragment: string, index: number): AuthoredBlock | undefined {
  const rows: string[][] = [];
  const rowPattern = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  for (const rowMatch of fragment.matchAll(rowPattern)) {
    const rowXml = rowMatch[0];
    const cells: string[] = [];
    const cellPattern = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    for (const cellMatch of rowXml.matchAll(cellPattern)) {
      const paragraphs = [...cellMatch[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
        .map((entry) => textFromXml(entry[0]))
        .filter((entry) => entry.length > 0);
      cells.push(paragraphs.join(' / '));
    }
    if (cells.some((cell) => cell.length > 0)) rows.push(cells);
  }
  if (rows.length === 0) return undefined;
  return {
    id: `t-${String(index).padStart(4, '0')}`,
    kind: 'table',
    order: index,
    rows,
  };
}

function buildSections(blocks: AuthoredBlock[]): AuthoredSection[] {
  type MutableSection = AuthoredSection & { blockIds: string[] };
  const sections: MutableSection[] = [];
  const stack: MutableSection[] = [];
  let index = 0;

  for (const block of blocks) {
    if (block.kind === 'paragraph' && block.headingLevel !== undefined) {
      while ((stack.at(-1)?.level ?? 0) >= block.headingLevel) stack.pop();
      index += 1;
      const parent = stack.at(-1);
      const section: MutableSection = {
        id: `section-${String(index).padStart(4, '0')}`,
        title: block.text,
        level: block.headingLevel,
        headingBlockId: block.id,
        ...(parent === undefined ? {} : { parentSectionId: parent.id }),
        blockIds: [],
      };
      sections.push(section);
      stack.push(section);
    }
    for (const section of stack) section.blockIds.push(block.id);
  }
  return sections;
}

export function parseDocxBytes(input: { bytes: Uint8Array; sourcePath: string }): AuthoredDocument {
  const files = unzipSync(input.bytes);
  const documentBytes = files['word/document.xml'];
  if (documentBytes === undefined) throw new Error('DOCX에서 word/document.xml을 찾지 못했습니다.');
  const documentXml = strFromU8(documentBytes);
  const stylesBytes = files['word/styles.xml'];
  const styles = buildStyleMap(stylesBytes === undefined ? undefined : strFromU8(stylesBytes));
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(documentXml)?.[1];
  if (body === undefined) throw new Error('DOCX 본문을 찾지 못했습니다.');

  const blocks: AuthoredBlock[] = [];
  let order = 0;
  let paragraphIndex = 0;
  let tableIndex = 0;
  const blockPattern = /<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g;
  for (const match of body.matchAll(blockPattern)) {
    order += 1;
    if (match[1] === 'p') {
      paragraphIndex += 1;
      const block = parseParagraph(match[0], paragraphIndex, styles);
      if (block !== undefined) blocks.push({ ...block, order });
    } else {
      tableIndex += 1;
      const block = parseTable(match[0], tableIndex);
      if (block !== undefined) blocks.push({ ...block, order });
    }
  }
  if (blocks.length === 0) throw new Error('DOCX에서 읽을 수 있는 본문 블록이 없습니다.');

  const contentHash = sha256Bytes(input.bytes);
  return AuthoredDocumentSchema.parse({
    schemaVersion: '0.1',
    documentId: `doc-${contentHash.slice(0, 12)}`,
    locale: 'ko-KR',
    source: { kind: 'docx', path: path.resolve(input.sourcePath), contentHash },
    blocks,
    sections: buildSections(blocks),
  });
}

export async function readDocxDocument(sourcePath: string): Promise<AuthoredDocument> {
  return parseDocxBytes({ bytes: await fs.readFile(sourcePath), sourcePath });
}

export function findSectionByTitle(document: AuthoredDocument, title: string): AuthoredSection | undefined {
  const normalized = title.replaceAll(/\s+/g, '').toLowerCase();
  return document.sections.find((section) => section.title.replaceAll(/\s+/g, '').toLowerCase().includes(normalized));
}

function numericTokens(text: string): string[] {
  return text.match(/[+\-±×]?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|초|G|회|개|배|마리|시간|\/초))?/g) ?? [];
}

export function buildContentInventory(input: {
  document: AuthoredDocument;
  sectionIds: string[];
  createdAt?: string;
}): ContentInventory {
  const selected = input.sectionIds.map((id) => input.document.sections.find((section) => section.id === id));
  if (selected.some((section) => section === undefined)) throw new Error('선택한 섹션을 문서에서 찾지 못했습니다.');
  const blockIds = new Set(selected.flatMap((section) => section?.blockIds ?? []));
  const items: ContentInventory['items'] = [];
  let itemIndex = 0;

  for (const block of input.document.blocks) {
    if (!blockIds.has(block.id)) continue;
    const section = [...selected]
      .filter((candidate): candidate is AuthoredSection => candidate !== undefined && candidate.blockIds.includes(block.id))
      .sort((left, right) => right.level - left.level)[0];
    const location = section?.title ?? '문서 본문';
    if (block.kind === 'paragraph') {
      itemIndex += 1;
      items.push({
        id: `item-${String(itemIndex).padStart(4, '0')}`,
        sourceBlockId: block.id,
        sourceLocation: location,
        type: block.headingLevel === undefined ? 'paragraph' : 'heading',
        sourceText: block.text,
        numericTokens: numericTokens(block.text),
      });
      continue;
    }
    for (const [rowIndex, row] of block.rows.entries()) {
      for (const [columnIndex, cell] of row.entries()) {
        if (cell.length === 0) continue;
        itemIndex += 1;
        items.push({
          id: `item-${String(itemIndex).padStart(4, '0')}`,
          sourceBlockId: block.id,
          sourceLocation: `${location} · 표 ${block.id} R${rowIndex + 1}C${columnIndex + 1}`,
          type: 'table-cell',
          sourceText: cell,
          numericTokens: numericTokens(cell),
        });
      }
    }
  }

  return ContentInventorySchema.parse({
    schemaVersion: '0.1',
    inventoryId: `inventory-${input.document.source.contentHash.slice(0, 12)}`,
    documentId: input.document.documentId,
    sourceHash: input.document.source.contentHash,
    selectedSectionIds: input.sectionIds,
    items,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}
