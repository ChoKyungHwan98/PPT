import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolvePdftoppm(): Promise<string> {
  const candidates = [
    process.env.PDFTOPPM_PATH,
    'C:\\Users\\Admin\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\poppler\\Library\\bin\\pdftoppm.exe',
    '/usr/local/bin/pdftoppm',
    '/usr/bin/pdftoppm',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0);
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error('pdftoppm 실행 파일을 찾을 수 없습니다.');
}

export async function rasterizeFirstPdfPage(input: {
  pdfPath: string;
  outputPrefix: string;
  dpi?: number;
}): Promise<string> {
  await mkdir(dirname(input.outputPrefix), { recursive: true });
  const executable = await resolvePdftoppm();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      executable,
      [
        '-f',
        '1',
        '-singlefile',
        '-png',
        '-r',
        String(input.dpi ?? 96),
        input.pdfPath,
        input.outputPrefix,
      ],
      { windowsHide: true },
    );
    let errorText = '';
    child.stderr.on('data', (chunk: Buffer) => {
      errorText += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('PDF rasterization failed: ' + errorText));
    });
  });
  return input.outputPrefix + '.png';
}

export type ImageComparison = {
  width: number;
  height: number;
  rootMeanSquareDifference: number;
  changedPixelFraction: number;
  passed: boolean;
};

export async function comparePngs(input: {
  expectedPath: string;
  actualPath: string;
  maximumRootMeanSquareDifference: number;
  maximumChangedPixelFraction: number;
}): Promise<ImageComparison> {
  const expectedImage = sharp(input.expectedPath).removeAlpha().raw();
  const actualImage = sharp(input.actualPath).removeAlpha().raw();
  const [expected, actual] = await Promise.all([
    expectedImage.toBuffer({ resolveWithObject: true }),
    actualImage.toBuffer({ resolveWithObject: true }),
  ]);
  if (
    expected.info.width !== actual.info.width ||
    expected.info.height !== actual.info.height ||
    expected.info.channels !== actual.info.channels
  ) {
    return {
      width: actual.info.width,
      height: actual.info.height,
      rootMeanSquareDifference: Number.POSITIVE_INFINITY,
      changedPixelFraction: 1,
      passed: false,
    };
  }
  let squareSum = 0;
  let changedPixels = 0;
  const channels = actual.info.channels;
  for (let offset = 0; offset < actual.data.length; offset += channels) {
    let pixelChanged = false;
    for (let channel = 0; channel < channels; channel += 1) {
      const difference = (actual.data[offset + channel] ?? 0) - (expected.data[offset + channel] ?? 0);
      squareSum += difference * difference;
      if (difference !== 0) pixelChanged = true;
    }
    if (pixelChanged) changedPixels += 1;
  }
  const rootMeanSquareDifference = Math.sqrt(squareSum / actual.data.length);
  const pixelCount = actual.info.width * actual.info.height;
  const changedPixelFraction = changedPixels / pixelCount;
  return {
    width: actual.info.width,
    height: actual.info.height,
    rootMeanSquareDifference: Math.round(rootMeanSquareDifference * 1000) / 1000,
    changedPixelFraction: Math.round(changedPixelFraction * 100000) / 100000,
    passed:
      rootMeanSquareDifference <= input.maximumRootMeanSquareDifference &&
      changedPixelFraction <= input.maximumChangedPixelFraction,
  };
}
