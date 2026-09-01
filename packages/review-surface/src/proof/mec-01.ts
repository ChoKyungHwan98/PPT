import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CandidateComparisonSchema } from '@game-presentation/contracts';
import { MEC_01_RAW_SOURCE } from '../../../contracts/fixtures/mec-01.js';
import { buildReviewHtml } from '../html.js';

type CandidateManifest = {
  signature: { candidateId: string };
  outputs: { pngPath: string };
};

async function main(): Promise<void> {
  const manifestPath = resolve('output', 'candidate-previews', 'mec-01', 'comparison-manifest.json');
  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    comparison: unknown;
    accepted: CandidateManifest[];
  };
  const comparison = CandidateComparisonSchema.parse(raw.comparison);
  const candidates = await Promise.all(
    raw.accepted.map(async (candidate) => ({
      candidateId: candidate.signature.candidateId,
      imageDataUrl: 'data:image/png;base64,' + (await readFile(candidate.outputs.pngPath)).toString('base64'),
    })),
  );
  const html = buildReviewHtml({
    title: '시간 파편 BREAK 메커니즘',
    sourceText: MEC_01_RAW_SOURCE,
    comparison,
    candidates,
  });
  const outputPath = resolve('output', 'review', 'mec-01', 'index.html');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');
  process.stdout.write(JSON.stringify({ outputPath, comparisonId: comparison.comparisonId }, null, 2) + '\n');
}

await main();
