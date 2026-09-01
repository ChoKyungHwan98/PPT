import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256Text } from '@game-presentation/contracts';
import { createHash } from 'node:crypto';

export type FontAsset = {
  family: string;
  weight: number;
  path: string;
  bytes: Uint8Array;
  fileHash: string;
  dataUrl: string;
};

export async function loadFontAsset(input: {
  family: string;
  weight: number;
  path: string;
}): Promise<FontAsset> {
  const bytes = await readFile(input.path);
  const fileHash = createHash('sha256').update(bytes).digest('hex');
  const mimeType = input.path.toLowerCase().endsWith('.otf') ? 'font/otf' : 'font/ttf';
  return {
    ...input,
    bytes,
    fileHash,
    dataUrl: 'data:' + mimeType + ';base64,' + bytes.toString('base64'),
  };
}

export function fontFaceCss(font: FontAsset): string {
  return [
    '@font-face {',
    "font-family: '" + font.family.replaceAll("'", "\\'") + "';",
    'src: url(\"' + font.dataUrl + '\");',
    'font-weight: ' + String(font.weight) + ';',
    'font-style: normal;',
    'font-display: block;',
    '}',
  ].join('');
}

export function fontSetHash(fonts: FontAsset[]): string {
  return sha256Text(
    [...fonts]
      .sort((left, right) => left.weight - right.weight)
      .map((font) => font.family + ':' + String(font.weight) + ':' + font.fileHash)
      .join('|'),
  );
}

async function firstExistingFont(paths: string[]): Promise<string> {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Continue to the next explicit candidate.
    }
  }
  throw new Error('Pretendard font files were not found.');
}

export async function loadSystemPretendard(): Promise<FontAsset[]> {
  const localFonts = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Windows', 'Fonts');
  const regular = await firstExistingFont([
    join(localFonts, 'Pretendard-Regular.ttf'),
    join(localFonts, 'Pretendard-Regular.otf'),
  ]);
  const bold = await firstExistingFont([
    join(localFonts, 'Pretendard-Bold.ttf'),
    join(localFonts, 'Pretendard-Bold.otf'),
  ]);
  const extraBold = await firstExistingFont([
    join(localFonts, 'Pretendard-ExtraBold.ttf'),
    join(localFonts, 'Pretendard-ExtraBold.otf'),
  ]);
  return Promise.all([
    loadFontAsset({ family: 'Pretendard', weight: 400, path: regular }),
    loadFontAsset({ family: 'Pretendard', weight: 700, path: bold }),
    loadFontAsset({ family: 'Pretendard', weight: 800, path: extraBold }),
  ]);
}
