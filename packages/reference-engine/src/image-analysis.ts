import { createHash } from 'node:crypto';
import sharp from 'sharp';

export type ImageRegionAnalysis = {
  column: number;
  row: number;
  inkDensity: number;
  meanLuminance: number;
};

export type ReferenceImageAnalysis = {
  width: number;
  height: number;
  format: string;
  aspectRatio: number;
  sourceSha256: string;
  perceptualHash: string;
  palette: string[];
  meanLuminance: number;
  whitespaceRatio: number;
  edgeDensity: number;
  laplacianVariance: number;
  regions: ImageRegionAnalysis[];
  quality: {
    accepted: boolean;
    reasons: string[];
  };
};

function hexColor(red: number, green: number, blue: number): string {
  return (
    '#' +
    [red, green, blue]
      .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function luminance(red: number, green: number, blue: number): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function perceptualHashFromPixels(pixels: Uint8Array): string {
  let bits = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = pixels[y * 9 + x] ?? 0;
      const right = pixels[y * 9 + x + 1] ?? 0;
      bits += left > right ? '1' : '0';
    }
  }
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

export function perceptualHashDistance(left: string, right: string): number {
  if (left.length !== right.length) throw new Error('perceptual hash 길이가 다릅니다.');
  let xor = BigInt('0x' + left) ^ BigInt('0x' + right);
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

export async function analyzeReferenceImage(bytes: Uint8Array): Promise<ReferenceImageAnalysis> {
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error('reference image 크기를 읽을 수 없습니다.');

  const sample = await sharp(bytes)
    .resize(90, 90, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const gray = await sharp(bytes).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer();
  const hashPixels = await sharp(bytes).resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();

  const paletteCounts = new Map<string, number>();
  let luminanceSum = 0;
  for (let offset = 0; offset < sample.length; offset += 3) {
    const red = sample[offset] ?? 0;
    const green = sample[offset + 1] ?? 0;
    const blue = sample[offset + 2] ?? 0;
    luminanceSum += luminance(red, green, blue);
    const quantized = hexColor(
      Math.min(255, Math.floor(red / 64) * 64 + 32),
      Math.min(255, Math.floor(green / 64) * 64 + 32),
      Math.min(255, Math.floor(blue / 64) * 64 + 32),
    );
    paletteCounts.set(quantized, (paletteCounts.get(quantized) ?? 0) + 1);
  }
  const palette = [...paletteCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([color]) => color);

  const cornerOffsets = [
    0,
    (90 - 1) * 3,
    (90 * (90 - 1)) * 3,
    (90 * 90 - 1) * 3,
  ];
  const background = [0, 1, 2].map((channel) =>
    Math.round(
      cornerOffsets.reduce((sum, offset) => sum + (sample[offset + channel] ?? 0), 0) /
        cornerOffsets.length,
    ),
  );
  let whitespacePixels = 0;
  for (let offset = 0; offset < sample.length; offset += 3) {
    const distance = Math.sqrt(
      ((sample[offset] ?? 0) - (background[0] ?? 0)) ** 2 +
        ((sample[offset + 1] ?? 0) - (background[1] ?? 0)) ** 2 +
        ((sample[offset + 2] ?? 0) - (background[2] ?? 0)) ** 2,
    );
    if (distance < 18) whitespacePixels += 1;
  }

  let edgeCount = 0;
  let comparisonCount = 0;
  let laplacianSum = 0;
  let laplacianSquareSum = 0;
  let laplacianCount = 0;
  for (let y = 1; y < 63; y += 1) {
    for (let x = 1; x < 63; x += 1) {
      const center = gray[y * 64 + x] ?? 0;
      const right = gray[y * 64 + x + 1] ?? 0;
      const below = gray[(y + 1) * 64 + x] ?? 0;
      if (Math.abs(center - right) > 28) edgeCount += 1;
      if (Math.abs(center - below) > 28) edgeCount += 1;
      comparisonCount += 2;
      const laplacian =
        (gray[(y - 1) * 64 + x] ?? 0) +
        (gray[(y + 1) * 64 + x] ?? 0) +
        (gray[y * 64 + x - 1] ?? 0) +
        (gray[y * 64 + x + 1] ?? 0) -
        4 * center;
      laplacianSum += laplacian;
      laplacianSquareSum += laplacian * laplacian;
      laplacianCount += 1;
    }
  }
  const laplacianMean = laplacianSum / Math.max(1, laplacianCount);
  const laplacianVariance =
    laplacianSquareSum / Math.max(1, laplacianCount) - laplacianMean * laplacianMean;

  const regions: ImageRegionAnalysis[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      let ink = 0;
      let light = 0;
      let count = 0;
      for (let y = row * 30; y < (row + 1) * 30; y += 1) {
        for (let x = column * 30; x < (column + 1) * 30; x += 1) {
          const offset = (y * 90 + x) * 3;
          const red = sample[offset] ?? 0;
          const green = sample[offset + 1] ?? 0;
          const blue = sample[offset + 2] ?? 0;
          const distance = Math.sqrt(
            (red - (background[0] ?? 0)) ** 2 +
              (green - (background[1] ?? 0)) ** 2 +
              (blue - (background[2] ?? 0)) ** 2,
          );
          if (distance >= 18) ink += 1;
          light += luminance(red, green, blue);
          count += 1;
        }
      }
      regions.push({
        column,
        row,
        inkDensity: Math.round((ink / count) * 10000) / 10000,
        meanLuminance: Math.round((light / count) * 10000) / 10000,
      });
    }
  }

  const reasons: string[] = [];
  if (width < 800 || height < 450) reasons.push('resolution-below-800x450');
  if (laplacianVariance < 20) reasons.push('likely-blurry-or-flat');
  if (width / height < 0.45 || width / height > 3) reasons.push('extreme-aspect-ratio');

  return {
    width,
    height,
    format: metadata.format ?? 'unknown',
    aspectRatio: Math.round((width / height) * 10000) / 10000,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    perceptualHash: perceptualHashFromPixels(hashPixels),
    palette,
    meanLuminance: Math.round((luminanceSum / (sample.length / 3)) * 10000) / 10000,
    whitespaceRatio: Math.round((whitespacePixels / (sample.length / 3)) * 10000) / 10000,
    edgeDensity: Math.round((edgeCount / comparisonCount) * 10000) / 10000,
    laplacianVariance: Math.round(laplacianVariance * 1000) / 1000,
    regions,
    quality: {
      accepted: reasons.length === 0,
      reasons,
    },
  };
}
