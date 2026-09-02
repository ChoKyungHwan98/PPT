import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import type { RenderTree } from '@game-presentation/contracts';
import type { FontAsset } from './font.js';
import { renderTreeToHtml } from './svg-renderer.js';

export async function exportRenderPreview(input: {
  browser: Browser;
  tree: RenderTree;
  fonts: FontAsset[];
  outputDir: string;
  basename: string;
}): Promise<{ htmlPath: string; pngPath: string; renderTreePath: string }> {
  await mkdir(input.outputDir, { recursive: true });
  const htmlPath = join(input.outputDir, input.basename + '.html');
  const pngPath = join(input.outputDir, input.basename + '.png');
  const renderTreePath = join(input.outputDir, input.basename + '.render-tree.json');
  const html = renderTreeToHtml(input.tree, input.fonts);
  await writeFile(htmlPath, html, 'utf8');
  await writeFile(renderTreePath, JSON.stringify(input.tree, null, 2) + '\n', 'utf8');
  const page = await input.browser.newPage({
    viewport: {
      width: input.tree.pageProfile.width,
      height: input.tree.pageProfile.height,
    },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const missingFonts = await page.evaluate((items) => items.filter((item) =>
      !document.fonts.check(
        `${String(item.weight)} ${String(item.size)}px ${JSON.stringify(item.family)}`,
        item.text,
      ),
    ), input.tree.nodes.flatMap((node) => node.kind === 'text' ? [{
      family: node.font.family,
      weight: node.font.weight,
      size: node.font.size,
      text: node.text,
    }] : []));
    if (missingFonts.length > 0) {
      throw new Error(`렌더링에 필요한 font가 로드되지 않았습니다: ${JSON.stringify(missingFonts)}`);
    }
    await page.screenshot({ path: pngPath, type: 'png', animations: 'disabled' });
  } finally {
    await page.close();
  }
  return { htmlPath, pngPath, renderTreePath };
}
