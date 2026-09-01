import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { buildContentInventory, parseDocxBytes } from '../src/docx.js';

const styles = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/></w:style>
</w:styles>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>전투 밸런스</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>밸런스 설계 목표</w:t></w:r></w:p>
  <w:tbl><w:tr>
    <w:tc><w:p><w:r><w:t>설계축</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>구현 방식</w:t></w:r></w:p></w:tc>
  </w:tr><w:tr>
    <w:tc><w:p><w:r><w:t>속도감</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>TTK 1.35초 고정</w:t></w:r></w:p></w:tc>
  </w:tr></w:tbl>
  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>튜닝 이력</w:t></w:r></w:p>
  <w:p><w:r><w:t>char_base_atk 200 → 280</w:t></w:r></w:p>
  <w:sectPr/>
</w:body></w:document>`;

describe('DOCX source ingestion', () => {
  it('preserves paragraph and table order while creating nested sections', () => {
    const bytes = zipSync({
      'word/document.xml': strToU8(documentXml),
      'word/styles.xml': strToU8(styles),
    });
    const parsed = parseDocxBytes({ bytes, sourcePath: 'fixture.docx' });
    expect(parsed.blocks.map((block) => block.kind)).toEqual(['paragraph', 'paragraph', 'table', 'paragraph', 'paragraph']);
    expect(parsed.sections.map((section) => section.title)).toEqual(['전투 밸런스', '밸런스 설계 목표', '튜닝 이력']);
    expect(parsed.sections[0]?.blockIds).toHaveLength(5);
    expect(parsed.sections[1]?.blockIds).toHaveLength(2);
  });

  it('creates traceable inventory items without changing numeric text', () => {
    const bytes = zipSync({
      'word/document.xml': strToU8(documentXml),
      'word/styles.xml': strToU8(styles),
    });
    const parsed = parseDocxBytes({ bytes, sourcePath: 'fixture.docx' });
    const goalSection = parsed.sections.find((section) => section.title === '밸런스 설계 목표');
    expect(goalSection).toBeDefined();
    const inventory = buildContentInventory({
      document: parsed,
      sectionIds: [goalSection!.id],
      createdAt: '2026-08-31T00:00:00.000Z',
    });
    expect(inventory.items.some((item) => item.sourceText === 'TTK 1.35초 고정')).toBe(true);
    expect(inventory.items.flatMap((item) => item.numericTokens)).toContain('1.35초');
  });
});
