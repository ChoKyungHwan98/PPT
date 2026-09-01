import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { PlannedSlide, PresentationPlan } from '@game-presentation/contracts';

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function chrome(plan: PresentationPlan, page: number): string {
  return `<div class="chrome"><b>${escape(plan.projectTitle)} · 밸런스 설계</b><span>${String(page).padStart(2, '0')} / ${String(plan.slides.length).padStart(2, '0')}</span></div>`;
}

function goalSlide(plan: PresentationPlan, slide: Extract<PlannedSlide, { role: 'goal-definition' }>, page: number): string {
  const goals = slide.goals.map((goal, index) => `<article class="goal goal-${index + 1}"><small>${escape(goal.axis)}</small><strong>${escape(goal.target)}</strong><b>${escape(goal.evidence)}</b><i></i></article>`).join('');
  return `<section class="page goal-page" data-slide-id="${escape(slide.id)}">${chrome(plan, page)}<header><h1>${escape(slide.title)}</h1><p>${escape(slide.message)}</p></header><div class="goals">${goals}</div><footer>${escape(plan.sectionTitle)}</footer></section>`;
}

function tuningSlide(plan: PresentationPlan, slide: Extract<PlannedSlide, { role: 'tuning-ledger' }>, page: number): string {
  const rows = slide.rows.map((row) => `<div class="tuning-row"><div><b>${escape(row.parameter)}</b></div><div class="versions">${row.values.map((value, index) => `<strong class="${index === row.values.length - 1 ? 'final' : ''}">${escape(value)}</strong>`).join('<i>→</i>')}</div><p>${escape(row.reason)}</p><aside><b>${escape(row.outcomeLabel)}</b><strong>${escape(row.outcomeValue)}</strong></aside></div>`).join('');
  return `<section class="page tuning-page" data-slide-id="${escape(slide.id)}">${chrome(plan, page)}<header><h1>${escape(slide.title)}</h1><p>${escape(slide.message)}</p></header><div class="tuning-head"><span>기준 파라미터</span><span>${slide.versions.map(escape).join('　　')}</span><span>조정 이유</span><span>최종 결과</span></div><div class="tuning-body">${rows}</div><footer>${escape(plan.sectionTitle)}</footer></section>`;
}

function validationSlide(plan: PresentationPlan, slide: Extract<PlannedSlide, { role: 'validation-summary' }>, page: number): string {
  const checks = slide.checks.map((check) => `<div class="check"><div><b>${escape(check.label)}</b><small>기준 ${escape(check.criterion)}</small></div><strong>${escape(check.result)}</strong><i>${check.status.toLowerCase() === 'pass' ? '통과' : escape(check.status)}</i></div>`).join('');
  return `<section class="page validation-page" data-slide-id="${escape(slide.id)}">${chrome(plan, page)}<div class="validation-main"><header><h1>${escape(slide.title)}</h1><p>${escape(slide.message)}</p></header><div class="checks">${checks}</div></div><aside class="monte"><b>Monte Carlo 검증</b><small>${slide.monteCarlo.passRate.startsWith('약') ? '약' : ''}</small><strong>${escape(slide.monteCarlo.passRate.replace(/^약\s*/, ''))}</strong><h2>N = ${escape(slide.monteCarlo.runs)} 통과율</h2><hr><p>${escape(slide.monteCarlo.sampling)}</p></aside><footer>${escape(plan.sectionTitle)}</footer></section>`;
}

function renderSlide(plan: PresentationPlan, slide: PlannedSlide, page: number): string {
  if (slide.role === 'goal-definition') return goalSlide(plan, slide, page);
  if (slide.role === 'tuning-ledger') return tuningSlide(plan, slide, page);
  return validationSlide(plan, slide, page);
}

const styles = `
@font-face{font-family:Pretendard;src:local("Pretendard")}*{box-sizing:border-box}html,body{margin:0;background:#d9d6cf;color:#252421;font-family:Pretendard,"Segoe UI",sans-serif}body{display:grid;gap:24px;justify-content:center;padding:24px}.page{position:relative;width:1600px;height:900px;overflow:hidden;background:#f3f1ec;padding:50px 90px;color:#252421;page-break-after:always}.chrome{height:46px;border-bottom:1px solid #d5d0c6;display:flex;justify-content:space-between;color:#74716b;font-size:17px}.chrome span{color:#9c978e}.page header h1{margin:42px 0 13px;max-width:1200px;font-size:57px;line-height:1.13;letter-spacing:-.045em}.page header p{margin:0;color:#74716b;font-size:22px}.page footer{position:absolute;left:90px;bottom:36px;color:#9c978e;font-size:13px}.goals{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;margin-top:72px}.goal{min-width:0;min-height:320px;padding:12px 22px 0 0;border-right:1px solid #d5d0c6}.goal:last-child{border:0}.goal small{display:block;color:#74716b;font-size:20px;font-weight:700}.goal strong{display:block;margin:35px 0 21px;font-size:40px;line-height:1.12;letter-spacing:-.035em;min-height:90px}.goal b{display:block;font-size:23px}.goal i{display:block;width:95%;height:4px;margin-top:65px;background:#252421}.goal-1 strong,.goal-1 i{color:#0f6b61;background:#0f6b61}.goal-3 strong,.goal-3 i{color:#c9533f;background:#c9533f}.tuning-page header h1{font-size:52px;max-width:1400px}.tuning-head{display:grid;grid-template-columns:320px 420px 230px 220px;gap:24px;margin-top:46px;color:#9c978e;font-size:15px;font-weight:700}.tuning-head span:nth-child(2),.tuning-head span:nth-child(4){text-align:center}.tuning-body{margin-top:14px}.tuning-row{height:132px;border-top:1px solid #d5d0c6;display:grid;grid-template-columns:320px 420px 230px 220px;gap:24px;align-items:center}.tuning-row>div>b{font-size:26px}.versions{display:flex;align-items:center;justify-content:space-around}.versions strong{font-size:37px}.versions strong.final{color:#c9533f}.versions i{font-style:normal;color:#9c978e;font-size:23px}.tuning-row p{color:#74716b;font-size:18px;font-weight:650}.tuning-row aside{text-align:right;color:#0f6b61}.tuning-row aside b,.tuning-row aside strong{display:block;font-size:21px}.validation-page{display:grid;grid-template-columns:1fr 470px;gap:62px}.validation-main header h1{font-size:51px}.checks{margin-top:34px}.check{height:101px;border-top:1px solid #d5d0c6;display:grid;grid-template-columns:300px 1fr 100px;align-items:center}.check div b,.check div small{display:block}.check div b{font-size:22px}.check div small{margin-top:9px;color:#74716b;font-size:15px}.check>strong{text-align:right;font-size:36px}.check>i{text-align:right;color:#0f6b61;font-style:normal;font-weight:800}.monte{height:690px;margin-top:68px;padding:58px 50px;background:#1f2725;color:#f7f5f0}.monte>b{font-size:22px;color:#d7e7e2}.monte>small{display:block;margin-top:105px;font-size:18px}.monte>strong{display:block;font-size:94px;line-height:1}.monte h2{font-size:24px}.monte hr{margin:40px 0;border:0;border-top:1px solid #53605c}.monte p{color:#c9cecb;font-size:16px;line-height:1.55}@media print{body{display:block;padding:0;background:white}.page{margin:0}.page:last-child{page-break-after:auto}}`;

const corrections = `.goal-1 strong{background:transparent}.goal-3 strong{background:transparent}.validation-page>.chrome{position:absolute;left:90px;right:90px;top:50px}.validation-main{grid-column:1;margin-top:68px}.validation-page>.monte{grid-column:2;margin-top:68px}`;

export function renderPresentationHtml(plan: PresentationPlan): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(plan.projectTitle)} · ${escape(plan.sectionTitle)}</title><style>${styles}${corrections}</style></head><body>${plan.slides.map((slide, index) => renderSlide(plan, slide, index + 1)).join('')}</body></html>`;
}

export type HtmlSlideValidation = {
  slideId: string;
  textOverflow: string[];
  outOfBounds: string[];
  collisions: string[];
  passed: boolean;
};

export type HtmlLayoutValidationReport = {
  checkedAt: string;
  slides: HtmlSlideValidation[];
  passed: boolean;
};

export async function writeHtmlOutputs(plan: PresentationPlan, outputDirectory: string, basename: string): Promise<{ html: string; pdf: string; pngs: string[]; validationReport: string; validation: HtmlLayoutValidationReport }> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const html = path.join(outputDirectory, `${basename}.html`);
  const pdf = path.join(outputDirectory, `${basename}.pdf`);
  const validationReport = path.join(outputDirectory, `${basename}.validation-report.json`);
  await fs.writeFile(html, renderPresentationHtml(plan), 'utf8');
  const installedBrowser = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(installedBrowser === undefined ? {} : { executablePath: installedBrowser }) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const pngs: string[] = [];
  try {
    await page.goto(`file:///${html.replaceAll('\\', '/')}`, { waitUntil: 'load' });
    await page.evaluate(async () => document.fonts.ready);
    await page.evaluate('globalThis.__name = (target) => target');
    const slides = page.locator('.page');
    const validationSlides = await slides.evaluateAll((slideElements) => slideElements.map((slide) => {
      const pageRect = slide.getBoundingClientRect();
      const textElements = [...slide.querySelectorAll<HTMLElement>('h1,h2,p,b,strong,small,span,i')]
        .filter((element) => element.children.length === 0 && (element.textContent?.trim().length ?? 0) > 0)
        .filter((element) => getComputedStyle(element).display !== 'none');
      const label = (element: HTMLElement) => `${element.tagName.toLowerCase()}:${(element.textContent ?? '').trim().slice(0, 48)}`;
      const textOverflow = textElements
        .filter((element) => {
          const style = getComputedStyle(element);
          const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip';
          const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip';
          return (clipsX && element.scrollWidth > element.clientWidth + 1) || (clipsY && element.scrollHeight > element.clientHeight + 1);
        })
        .map(label);
      const outOfBounds = textElements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < pageRect.left - 1 || rect.top < pageRect.top - 1 || rect.right > pageRect.right + 1 || rect.bottom > pageRect.bottom + 1;
      }).map(label);
      const collisions: string[] = [];
      for (let leftIndex = 0; leftIndex < textElements.length; leftIndex += 1) {
        const left = textElements[leftIndex];
        if (left === undefined) continue;
        const leftRect = left.getBoundingClientRect();
        for (let rightIndex = leftIndex + 1; rightIndex < textElements.length; rightIndex += 1) {
          const right = textElements[rightIndex];
          if (right === undefined || left.contains(right) || right.contains(left)) continue;
          const rightRect = right.getBoundingClientRect();
          const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
          const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
          if (overlapWidth > 2 && overlapHeight > 2) collisions.push(`${label(left)} ↔ ${label(right)}`);
        }
      }
      const slideId = slide.getAttribute('data-slide-id') ?? 'unknown-slide';
      return { slideId, textOverflow, outOfBounds, collisions, passed: textOverflow.length === 0 && outOfBounds.length === 0 && collisions.length === 0 };
    }));
    const validation: HtmlLayoutValidationReport = { checkedAt: new Date().toISOString(), slides: validationSlides, passed: validationSlides.every((slide) => slide.passed) };
    await fs.writeFile(validationReport, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
    for (let index = 0; index < await slides.count(); index += 1) {
      const png = path.join(outputDirectory, `${basename}.page-${String(index + 1).padStart(2, '0')}.png`);
      await slides.nth(index).screenshot({ path: png });
      pngs.push(png);
    }
    await page.pdf({ path: pdf, width: '16.6667in', height: '9.375in', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    return { html, pdf, pngs, validationReport, validation };
  } finally {
    await browser.close();
  }
}
