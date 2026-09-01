import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import type { RenderTree } from '@game-presentation/contracts';
import { contentHash } from '@game-presentation/contracts';
import type { FontAsset } from './font.js';
import { renderTreeToHtml } from './svg-renderer.js';

export type RenderOutputs = {
  htmlPath: string;
  pngPath: string;
  pdfPath: string;
  renderTreePath: string;
  manifestPath: string;
};

export async function exportRenderTree(input: {
  browser: Browser;
  tree: RenderTree;
  fonts: FontAsset[];
  outputDir: string;
  basename: string;
}): Promise<RenderOutputs> {
  await mkdir(input.outputDir, { recursive: true });
  const htmlPath = join(input.outputDir, input.basename + '.html');
  const pngPath = join(input.outputDir, input.basename + '.png');
  const pdfPath = join(input.outputDir, input.basename + '.pdf');
  const renderTreePath = join(input.outputDir, input.basename + '.render-tree.json');
  const manifestPath = join(input.outputDir, input.basename + '.manifest.json');
  const html = renderTreeToHtml(input.tree, input.fonts);

  await writeFile(htmlPath, html, 'utf8');
  await writeFile(renderTreePath, JSON.stringify(input.tree, null, 2) + '\n', 'utf8');

  const page = await input.browser.newPage({
    viewport: {
      width: input.tree.pageProfile.width,
      height: input.tree.pageProfile.height,
    },
    deviceScaleFactor: input.tree.pageProfile.pixelRatio,
  });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({
      path: pngPath,
      type: 'png',
      fullPage: false,
      animations: 'disabled',
    });
    await page.pdf({
      path: pdfPath,
      width: String(input.tree.pageProfile.width / 96) + 'in',
      height: String(input.tree.pageProfile.height / 96) + 'in',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      tagged: true,
    });
  } finally {
    await page.close();
  }

  const manifest = {
    schemaVersion: '0.1',
    renderTreeId: input.tree.renderTreeId,
    deterministicFingerprint: input.tree.deterministicFingerprint,
    outputFingerprint: contentHash({
      html,
      tree: input.tree,
      fonts: input.fonts.map((font) => ({ family: font.family, weight: font.weight, hash: font.fileHash })),
    }),
    outputs: {
      html: input.basename + '.html',
      png: input.basename + '.png',
      pdf: input.basename + '.pdf',
      renderTree: input.basename + '.render-tree.json',
    },
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { htmlPath, pngPath, pdfPath, renderTreePath, manifestPath };
}
