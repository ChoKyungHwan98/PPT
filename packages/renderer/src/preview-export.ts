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
    await page.screenshot({ path: pngPath, type: 'png', animations: 'disabled' });
  } finally {
    await page.close();
  }
  return { htmlPath, pngPath, renderTreePath };
}
