import type { Browser } from 'playwright';
import { fontFaceCss, type FontAsset } from './font.js';

export type TextMeasureRequest = {
  key: string;
  text: string;
  family: string;
  weight: number;
  size: number;
  letterSpacing: number;
};

export type TextMeasurement = TextMeasureRequest & {
  width: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
};

export async function measureTextBatch(
  browser: Browser,
  fonts: FontAsset[],
  requests: TextMeasureRequest[],
): Promise<Map<string, TextMeasurement>> {
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  try {
    await page.setContent(
      '<!doctype html><html><head><style>' +
        fonts.map(fontFaceCss).join('') +
        '</style></head><body></body></html>',
      { waitUntil: 'load' },
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const values = await page.evaluate((items) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('Canvas 2D context is unavailable.');
      return items.map((item) => {
        context.font = String(item.weight) + ' ' + String(item.size) + 'px ' + JSON.stringify(item.family);
        const metrics = context.measureText(item.text);
        const spacingWidth = Math.max(0, item.text.length - 1) * item.letterSpacing;
        return {
          ...item,
          width: metrics.width + spacingWidth,
          actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
          actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
        };
      });
    }, requests);
    return new Map(values.map((value) => [value.key, value]));
  } finally {
    await page.close();
  }
}
