import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  ArtifactReadinessJudgementSchema,
  RenderTreeSchema,
  type RenderTree,
} from '@game-presentation/contracts';
import {
  validateEditablePptxArtifact,
  writeEditablePptxFromRenderTree,
} from '@game-presentation/pptx-exporter';
import {
  interpretAuthoredHierarchy,
  type AuthoredHierarchy,
} from '../../../source-ingestion/src/authored-hierarchy.js';
import { launchRenderBrowser } from '../browser.js';
import { exportRenderTree } from '../export.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { validatePdfArtifact } from '../pdf-validation.js';

const fixtureDir = resolve('packages/renderer/fixtures/organization-structure');
const sourcePngPath = resolve(fixtureDir, 'organization-structure-candidate-b-hierarchy-focus.png');
const sourceTreePath = resolve(fixtureDir, 'organization-structure-candidate-b-hierarchy-focus.render-tree.json');
const sourcePath = resolve('packages/source-ingestion/fixtures/combat-system-organization.source.json');
const outputDir = resolve(fixtureDir, 'v1-stage-9');
const basename = 'organization-best-known-not-ready';
const artifactId = 'organization-structure-candidate-b-hierarchy-focus';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function visibleTexts(tree: RenderTree): string[] {
  return tree.nodes.flatMap((node) => node.kind === 'text' && node.visible ? [node.text] : []);
}

async function main(): Promise<void> {
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as AuthoredHierarchy;
  const { slide, informationPlan } = interpretAuthoredHierarchy(source);
  const tree = RenderTreeSchema.parse(JSON.parse(await readFile(sourceTreePath, 'utf8')));
  const hardGate = runHardGate({ slide, informationPlan, tree });
  if (!hardGate.passed) throw new Error(`Stage 9 직전 Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);

  const sourcePngBytes = await readFile(sourcePngPath);
  const sourcePngHash = sha256(sourcePngBytes);
  const judgement = ArtifactReadinessJudgementSchema.parse({
    schemaVersion: '0.1',
    judgementId: 'judgement-organization-structure-best-known-not-ready',
    artifactId,
    evaluatedPng: {
      path: 'packages/renderer/fixtures/organization-structure/organization-structure-candidate-b-hierarchy-focus.png',
      sha256: sourcePngHash,
    },
    decidedBy: 'user',
    decision: 'rejected-as-ready',
    decidedAt: '2026-09-05T00:00:00.000Z',
    readyPositiveFixture: false,
    reason: '구조와 정보 전달은 정상이나 현재 시각 품질은 portfolio-ready 수준으로 승인하지 않음',
    separation: {
      teacherQualityAffected: false,
      preferenceEventRecorded: false,
    },
  });
  await mkdir(outputDir, { recursive: true });
  const judgementPath = resolve(fixtureDir, 'organization-structure-best-known-not-ready.user-judgement.json');
  await writeFile(judgementPath, JSON.stringify(judgement, null, 2) + '\n', 'utf8');

  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  let renderOutputs: Awaited<ReturnType<typeof exportRenderTree>>;
  try {
    renderOutputs = await exportRenderTree({ browser, tree, fonts, outputDir, basename });
  } finally {
    await browser.close();
  }
  const pptxPath = resolve(outputDir, `${basename}.editable.pptx`);
  await writeEditablePptxFromRenderTree(tree, pptxPath);

  const requiredText = visibleTexts(tree);
  const requiredRelationIds = slide.relations.map((relation) => relation.id);
  const pdfValidation = await validatePdfArtifact({
    pdfPath: renderOutputs.pdfPath,
    requiredText,
    expectedPageCount: 1,
    expectedAspectRatio: 16 / 9,
  });
  if (!pdfValidation.passed) throw new Error(`PDF 검증 실패: ${JSON.stringify(pdfValidation)}`);
  const pptxValidation = await validateEditablePptxArtifact({ pptxPath, requiredText, requiredRelationIds });
  if (!pptxValidation.passed) throw new Error(`editable PPTX 검증 실패: ${JSON.stringify(pptxValidation)}`);

  const pngBytes = await readFile(renderOutputs.pngPath);
  const pngMetadata = await sharp(pngBytes).metadata();
  const pngSize = (await stat(renderOutputs.pngPath)).size;
  if (pngMetadata.width !== 1920 || pngMetadata.height !== 1080 || pngSize === 0) {
    throw new Error('Stage 9 PNG 해상도 또는 파일 크기 검증에 실패했습니다.');
  }
  if (sha256(pngBytes) !== sourcePngHash) {
    throw new Error('Stage 9 PNG가 동결한 best-known RenderTree 결과와 다릅니다.');
  }

  const html = await readFile(renderOutputs.htmlPath, 'utf8');
  const missingHtmlText = requiredText.filter((text) => !html.includes(text));
  if (missingHtmlText.length > 0) throw new Error(`HTML 원문 누락: ${JSON.stringify(missingHtmlText)}`);

  const proof = {
    schemaVersion: '0.1',
    artifactId,
    classification: 'best-known / not-ready',
    purpose: 'V1 output-pipeline verification only',
    readyPositiveFixture: false,
    furtherRevisionAllowed: false,
    sourceArtifact: {
      png: 'packages/renderer/fixtures/organization-structure/organization-structure-candidate-b-hierarchy-focus.png',
      renderTree: 'packages/renderer/fixtures/organization-structure/organization-structure-candidate-b-hierarchy-focus.render-tree.json',
      renderTreeFingerprint: tree.deterministicFingerprint,
    },
    stage8: judgement,
    stage9: {
      outputs: {
        png: `packages/renderer/fixtures/organization-structure/v1-stage-9/${basename}.png`,
        html: `packages/renderer/fixtures/organization-structure/v1-stage-9/${basename}.html`,
        pdf: `packages/renderer/fixtures/organization-structure/v1-stage-9/${basename}.pdf`,
        editablePptx: `packages/renderer/fixtures/organization-structure/v1-stage-9/${basename}.editable.pptx`,
        renderTree: `packages/renderer/fixtures/organization-structure/v1-stage-9/${basename}.render-tree.json`,
      },
      semanticParity: {
        requiredText,
        relationIds: requiredRelationIds,
        missingHtmlText,
        changed: false,
      },
      hardGate: {
        passed: hardGate.passed,
        programFindingCount: hardGate.programFindings.length,
        sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
      },
      pngValidation: {
        width: pngMetadata.width,
        height: pngMetadata.height,
        bytes: pngSize,
        sha256: sha256(pngBytes),
      },
      pdfValidation,
      editablePptxValidation: pptxValidation,
    },
    fontHashes: fonts.map((font) => ({ family: font.family, weight: font.weight, sha256: font.fileHash })),
  };
  const proofPath = resolve(outputDir, `${basename}.proof.json`);
  await writeFile(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({ ...proof, proofPath }, null, 2) + '\n');
}

await main();
