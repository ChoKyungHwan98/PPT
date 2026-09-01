import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  CandidateComparisonSchema,
  PairwisePreferenceRecordSchema,
  RenderTreeSchema,
  contentHash,
  hasSevereFindings,
  sha256Bytes,
  validateRenderTreeAgainstSlide,
} from '@game-presentation/contracts';
import { resolvePairwiseSelection } from '@game-presentation/composition-engine';
import { VersionedPreferenceStore } from '@game-presentation/preference-learning';
import { MEC_01_SLIDE_IR } from '../../../contracts/fixtures/mec-01.js';
import { launchRenderBrowser } from '../browser.js';
import { exportRenderTree } from '../export.js';
import { loadSystemPretendard } from '../font.js';
import { comparePngs, rasterizeFirstPdfPage } from '../image-validation.js';
import { validateLayout } from '../layout-validation.js';
import { validatePdfArtifact } from '../pdf-validation.js';

type AcceptedManifest = {
  signature: { candidateId: string };
  outputs: { pngPath: string; renderTreePath: string };
};

async function main(): Promise<void> {
  const preferencePath = process.argv[2];
  if (preferencePath === undefined) {
    throw new Error('비교 화면에서 내려받은 .preference.json 파일 경로가 필요합니다.');
  }
  const manifestPath = resolve('output', 'candidate-previews', 'mec-01', 'comparison-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    comparison: unknown;
    accepted: AcceptedManifest[];
  };
  const comparison = CandidateComparisonSchema.parse(manifest.comparison);
  const preference = PairwisePreferenceRecordSchema.parse(
    JSON.parse(await readFile(resolve(preferencePath), 'utf8')),
  );
  const resolution = resolvePairwiseSelection({ comparison, preference });
  const preferenceStore = new VersionedPreferenceStore(resolve('output', 'preferences', 'mec-01'));
  const stored = await preferenceStore.append(preference);
  const runId = contentHash(preference).slice(0, 16);
  const outputDir = resolve('output', 'selected', 'mec-01', runId);
  await mkdir(outputDir, { recursive: true });

  if (resolution.status !== 'selected') {
    const resultPath = join(outputDir, 'selection-result.json');
    await writeFile(
      resultPath,
      JSON.stringify({ status: resolution.status, preferenceVersionHash: stored.versionHash }, null, 2) + '\n',
      'utf8',
    );
    process.stdout.write(JSON.stringify({ status: resolution.status, resultPath }, null, 2) + '\n');
    return;
  }

  const selected = manifest.accepted.find(
    (candidate) => candidate.signature.candidateId === resolution.candidate.candidateId,
  );
  if (selected === undefined) throw new Error('선택 후보의 실제 렌더 evidence를 찾을 수 없습니다.');
  const tree = RenderTreeSchema.parse(
    JSON.parse(await readFile(selected.outputs.renderTreePath, 'utf8')),
  );
  if (contentHash(tree) !== resolution.candidate.renderTreeHash) {
    throw new Error('선택 이후 RenderTree가 변경되었습니다.');
  }
  if (sha256Bytes(await readFile(selected.outputs.pngPath)) !== resolution.candidate.pngHash) {
    throw new Error('선택 이후 PNG evidence가 변경되었습니다.');
  }
  const findings = [...validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR), ...validateLayout(tree)];
  if (hasSevereFindings(findings)) {
    throw new Error('선택된 후보가 현재 hard gate를 통과하지 못합니다: ' + JSON.stringify(findings));
  }

  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const outputs = await exportRenderTree({
      browser,
      tree,
      fonts,
      outputDir,
      basename: 'mec-01-selected',
    });
    const pdfValidation = await validatePdfArtifact({
      pdfPath: outputs.pdfPath,
      requiredText: tree.nodes.flatMap((node) =>
        node.kind === 'text' && node.visible ? [node.text] : [],
      ),
      expectedPageCount: 1,
      expectedAspectRatio: 16 / 9,
    });
    if (!pdfValidation.passed) {
      throw new Error('선택 PDF 검증에 실패했습니다: ' + JSON.stringify(pdfValidation));
    }
    const reopenedPngPath = await rasterizeFirstPdfPage({
      pdfPath: outputs.pdfPath,
      outputPrefix: resolve('tmp', 'pdfs', 'selected-mec-01-' + runId, 'pdf-render'),
      dpi: 96,
    });
    const rasterComparison = await comparePngs({
      expectedPath: outputs.pngPath,
      actualPath: reopenedPngPath,
      maximumRootMeanSquareDifference: 12,
      maximumChangedPixelFraction: 0.14,
    });
    if (!rasterComparison.passed) {
      throw new Error('선택 PDF 재렌더 비교에 실패했습니다: ' + JSON.stringify(rasterComparison));
    }
    const resultPath = join(outputDir, 'selection-result.json');
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          status: 'selected',
          slot: resolution.slot,
          candidateId: resolution.candidate.candidateId,
          preferenceVersionHash: stored.versionHash,
          outputs,
          findings,
          pdfValidation,
          rasterComparison,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    process.stdout.write(JSON.stringify({ status: 'selected', outputs, resultPath }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
