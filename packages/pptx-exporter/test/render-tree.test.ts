import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RenderTreeSchema } from '@game-presentation/contracts';
import { validateEditablePptxArtifact, writeEditablePptxFromRenderTree } from '../src/render-tree.js';

describe('RenderTree editable PPTX compatibility exporter', () => {
  it('keeps Organization text and hierarchy relations as native editable objects without raster fallback', async () => {
    const tree = RenderTreeSchema.parse(JSON.parse(await readFile(
      new URL('../../renderer/fixtures/organization-structure/organization-structure-candidate-b-hierarchy-focus.render-tree.json', import.meta.url),
      'utf8',
    )));
    const outputDir = await mkdtemp(join(tmpdir(), 'game-ppt-stage9-'));
    const pptxPath = join(outputDir, 'organization-editable.pptx');
    await writeEditablePptxFromRenderTree(tree, pptxPath);
    const requiredText = tree.nodes.flatMap((node) => node.kind === 'text' ? [node.text] : []);
    const requiredRelationIds = tree.nodes.flatMap((node) => node.relationId === undefined ? [] : [node.relationId]);
    const report = await validateEditablePptxArtifact({ pptxPath, requiredText, requiredRelationIds });
    expect(report).toMatchObject({
      slideCount: 1,
      pictureCount: 0,
      mediaAssetCount: 0,
      missingRequiredText: [],
      missingRelationIds: [],
      pretendardDeclared: true,
      oneSlide16By9: true,
      passed: true,
    });
    expect(report.editableTextRunCount).toBeGreaterThanOrEqual(requiredText.length);
    expect(report.nativeLineCount).toBeGreaterThanOrEqual(requiredRelationIds.length);
  });
});
