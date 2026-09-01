import { access } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveChromiumExecutable(): Promise<string> {
  const candidates = [
    process.env.CHROME_PATH,
    chromium.executablePath(),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0);
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error('Chrome 또는 Chromium 실행 파일을 찾을 수 없습니다.');
}

export async function launchRenderBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: await resolveChromiumExecutable(),
  });
}
