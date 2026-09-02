import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { RenderTreeSchema } from '@game-presentation/contracts';
import { createMec01InformationPlan, interpretMec01Source } from '../../../source-ingestion/src/mec-01-semantic.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { exportRenderPreview } from '../preview-export.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const basename = 'mec-01-accumulation-threshold-consequence';
const fixtureDir = resolve('packages', 'renderer', 'fixtures');
const renderTreePath = resolve(fixtureDir, `${basename}.render-tree.json`);

async function main(): Promise<void> {
  const tree = RenderTreeSchema.parse(JSON.parse(await readFile(renderTreePath, 'utf8')));
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const hardGate = runHardGate({ slide, informationPlan, tree });
  if (!hardGate.passed) {
    throw new Error(`PNG 생성 전 Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
  }

  const fonts = await loadSystemPretendard();
  const fontHashes = new Set(fonts.map((font) => font.fileHash));
  const invalidFontNodes = tree.nodes.filter((node) =>
    node.kind === 'text' &&
    (node.font.family !== 'Pretendard' || !fontHashes.has(node.font.fileHash)),
  );
  if (invalidFontNodes.length > 0) {
    throw new Error(`RenderTree의 font hash가 production Pretendard와 다릅니다: ${JSON.stringify(
      invalidFontNodes.map((node) => node.nodeId),
    )}`);
  }

  const browser = await launchRenderBrowser();
  try {
    const outputs = await exportRenderPreview({
      browser,
      tree,
      fonts,
      outputDir: fixtureDir,
      basename,
    });
    const pngBytes = await readFile(outputs.pngPath);
    const pngStat = await stat(outputs.pngPath);
    const metadata = await sharp(pngBytes).metadata();
    if (pngStat.size <= 0 || metadata.width !== 1920 || metadata.height !== 1080) {
      throw new Error(`PNG 자동 검사 실패: ${JSON.stringify({
        size: pngStat.size,
        width: metadata.width,
        height: metadata.height,
      })}`);
    }
    process.stdout.write(JSON.stringify({
      outputs,
      width: metadata.width,
      height: metadata.height,
      fileSizeBytes: pngStat.size,
      pngSha256: createHash('sha256').update(pngBytes).digest('hex'),
      deterministicFingerprint: tree.deterministicFingerprint,
      fontHashes: fonts.map((font) => ({ weight: font.weight, hash: font.fileHash })),
      hardGate: {
        passed: hardGate.passed,
        programFindingCount: hardGate.programFindings.length,
        sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
      },
      rendererPath: 'RenderTree -> renderTreeToHtml -> SVG -> Playwright Chromium screenshot',
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
