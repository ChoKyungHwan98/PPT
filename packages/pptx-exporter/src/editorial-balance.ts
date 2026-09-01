import path from 'node:path';
import { createRequire } from 'node:module';
import type { PlannedSlide, PresentationPlan } from '@game-presentation/contracts';

const PptxGenJS = createRequire(import.meta.url)('pptxgenjs') as typeof import('pptxgenjs').default;

const COLOR = {
  paper: 'F3F1EC',
  ink: '252421',
  muted: '74716B',
  faint: '9C978E',
  rule: 'D5D0C6',
  teal: '0F6B61',
  tealSoft: 'D7E7E2',
  coral: 'C9533F',
  dark: '1F2725',
  light: 'F7F5F0',
};
const FONT = 'Pretendard';
const PX = 1 / 96;

type Presentation = InstanceType<typeof PptxGenJS>;
type Slide = ReturnType<Presentation['addSlide']>;

function inch(value: number): number {
  return value * PX;
}

function addText(
  slide: Slide,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fontSize?: number;
    bold?: boolean;
    color?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'mid' | 'bottom';
    breakLine?: boolean;
  } = {},
): void {
  slide.addText(text, {
    x: inch(x),
    y: inch(y),
    w: inch(width),
    h: inch(height),
    fontFace: FONT,
    fontSize: options.fontSize ?? 16,
    bold: options.bold ?? false,
    color: options.color ?? COLOR.ink,
    align: options.align ?? 'left',
    valign: options.valign === 'mid' ? 'middle' : (options.valign ?? 'top'),
    margin: 0,
    breakLine: options.breakLine ?? false,
    fit: 'shrink',
  });
}

function addLine(slide: Slide, x: number, y: number, width: number, height = 0, color = COLOR.rule, weight = 1): void {
  slide.addShape('line', {
    x: inch(x),
    y: inch(y),
    w: inch(width),
    h: inch(height),
    line: { color, width: weight },
  });
}

function addHeader(slide: Slide, plan: PresentationPlan, page: number): void {
  addText(slide, `${plan.projectTitle} · 밸런스 설계`, 72, 38, 420, 24, { fontSize: 12, bold: true, color: COLOR.muted });
  addText(slide, `${String(page).padStart(2, '0')} / ${String(plan.slides.length).padStart(2, '0')}`, 1080, 38, 128, 24, {
    fontSize: 11,
    color: COLOR.faint,
    align: 'right',
  });
  addLine(slide, 72, 76, 1136);
}

function addFooter(slide: Slide, plan: PresentationPlan): void {
  addText(slide, `${plan.sectionTitle}`, 72, 678, 560, 18, { fontSize: 9, color: COLOR.faint });
}

function setNotes(slide: Slide, plan: PresentationPlan, sourceBlockIds: string[]): void {
  slide.addNotes(`[Sources]\n- ${plan.sourceHash} · source blocks: ${sourceBlockIds.join(', ')}\n[/Sources]`);
}

function targetMetric(axis: string, target: string): string {
  if (axis.includes('속도')) return /([\d.]+\s*초)/.exec(target)?.[1]?.replaceAll(' ', '') ?? target;
  if (axis.includes('성장')) {
    const character = /캐릭터\s*(×[\d.]+)/.exec(target)?.[1];
    const equipment = /장비\s*(×[\d.]+)/.exec(target)?.[1];
    if (character !== undefined && equipment !== undefined) return `${character} · ${equipment}`;
  }
  if (axis.includes('보스')) {
    const range = /(\d+)\s*[~–-]\s*(\d+)\s*초/.exec(target);
    if (range?.[1] !== undefined && range[2] !== undefined) return `${range[1]}–${range[2]}초`;
  }
  return target;
}

function renderGoalSlide(slide: Slide, plan: PresentationPlan, planned: Extract<PlannedSlide, { role: 'goal-definition' }>, page: number): void {
  addHeader(slide, plan, page);
  addText(slide, '속도감·성장감·보스 긴장감을\n먼저 수치 목표로 고정했다', 72, 105, 920, 112, { fontSize: 38, bold: true });
  addText(slide, '파라미터를 조정하기 전에 플레이 감각을 검증 가능한 기준으로 바꿨다.', 72, 225, 900, 30, {
    fontSize: 15,
    color: COLOR.muted,
  });
  const columnCount = planned.goals.length;
  const available = 1136;
  const gap = 36;
  const width = (available - gap * (columnCount - 1)) / columnCount;
  const accents = [COLOR.teal, COLOR.ink, COLOR.coral];
  planned.goals.forEach((goal, index) => {
    const x = 72 + index * (width + gap);
    const accent = accents[index] ?? COLOR.ink;
    addText(slide, goal.axis, x, 310, width, 28, { fontSize: 14, bold: true, color: COLOR.muted });
    addText(slide, targetMetric(goal.axis, goal.target), x, 354, width, 68, {
      fontSize: index === 1 ? 32 : 42,
      bold: true,
      color: accent,
    });
    addText(slide, goal.evidence, x, 430, width, 40, { fontSize: 17, bold: true });
    addText(slide, goal.target, x, 485, width, 64, { fontSize: 13, color: COLOR.muted });
    addLine(slide, x, 568, width, 0, accent, 2.5);
    slide.addShape('ellipse', { x: inch(x + width - 6), y: inch(562.5), w: inch(11), h: inch(11), line: { color: accent, transparency: 100 }, fill: { color: accent } });
    if (index < columnCount - 1) addLine(slide, x + width + gap / 2, 300, 0, 284);
  });
  addText(slide, planned.message, 72, 612, 920, 32, { fontSize: 16, bold: true });
  addFooter(slide, plan);
  setNotes(slide, plan, planned.sourceBlockIds);
}

const parameterDescriptions: Record<string, string> = {
  char_base_atk: '캐릭터 기준 ATK',
  equip_base: '장비 기준 ATK',
  mon_boss_atk: '보스 기준 ATK',
};

function renderTuningSlide(slide: Slide, plan: PresentationPlan, planned: Extract<PlannedSlide, { role: 'tuning-ledger' }>, page: number): void {
  addHeader(slide, plan, page);
  addText(slide, '기준 파라미터를 조정해 초반 DPS·장비 비중을 맞추고,', 72, 105, 1060, 48, { fontSize: 30, bold: true });
  addText(slide, '보스 생존 시간을 복원했다', 72, 158, 1060, 48, { fontSize: 30, bold: true });
  addText(slide, '문제를 만든 값을 추적하고, 한 번에 하나의 기준선을 다시 맞췄다.', 72, 220, 900, 30, {
    fontSize: 15,
    color: COLOR.muted,
  });
  addText(slide, '기준 파라미터', 72, 270, 265, 22, { fontSize: 11, bold: true, color: COLOR.faint });
  planned.versions.forEach((version, index) => addText(slide, version, 390 + index * 130, 270, 100, 22, {
    fontSize: 11,
    bold: true,
    color: COLOR.faint,
    align: 'center',
  }));
  addText(slide, '조정 이유', 800, 270, 205, 22, { fontSize: 11, bold: true, color: COLOR.faint });
  addText(slide, '최종 결과', 1035, 270, 173, 22, { fontSize: 11, bold: true, color: COLOR.faint });
  const rowYs = [315, 420, 525];
  planned.rows.forEach((row, rowIndex) => {
    const y = rowYs[rowIndex] ?? 315 + rowIndex * 96;
    addLine(slide, 72, y - 12, 1136);
    addText(slide, row.parameter, 72, y + 7, 275, 30, { fontSize: 16, bold: true });
    addText(slide, parameterDescriptions[row.parameter] ?? '기준 파라미터', 72, y + 44, 260, 22, { fontSize: 11, color: COLOR.muted });
    row.values.forEach((value, valueIndex) => {
      const x = 390 + valueIndex * 130;
      addText(slide, value, x, y + 8, 100, 42, {
        fontSize: 25,
        bold: true,
        color: valueIndex === row.values.length - 1 ? COLOR.coral : COLOR.ink,
        align: 'center',
      });
      if (valueIndex < row.values.length - 1) addText(slide, '→', x + 101, y + 15, 30, 28, { fontSize: 16, color: COLOR.faint, align: 'center' });
    });
    addText(slide, row.reason, 800, y + 13, 205, 46, { fontSize: 14, bold: true, color: COLOR.muted, valign: 'mid' });
    addText(slide, row.outcomeLabel, 1035, y + 2, 173, 28, { fontSize: 15, bold: true, color: COLOR.teal });
    addText(slide, row.outcomeValue, 1035, y + 36, 173, 30, { fontSize: 16, bold: true, color: COLOR.teal });
  });
  addLine(slide, 72, 618, 1136);
  addText(slide, planned.versions.join(' → ') + ' 튜닝 이력', 72, 632, 410, 24, { fontSize: 11, color: COLOR.faint });
  addText(slide, planned.message, 700, 629, 508, 26, { fontSize: 13, color: COLOR.muted, align: 'right' });
  addFooter(slide, plan);
  setNotes(slide, plan, planned.sourceBlockIds);
}

function splitValidationTitle(title: string): [string, string, string] {
  const match = /^(.*충족했고),\s*([\d,]+회 표본에서도 .*가)\s*(통과했다)$/.exec(title);
  return match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined
    ? [match[1], match[2], match[3]]
    : [title, '', ''];
}

function renderValidationSlide(slide: Slide, plan: PresentationPlan, planned: Extract<PlannedSlide, { role: 'validation-summary' }>, page: number): void {
  addHeader(slide, plan, page);
  const titleLines = splitValidationTitle(planned.title);
  addText(slide, titleLines.filter((line) => line.length > 0).join('\n'), 72, 105, 730, 142, { fontSize: 30, bold: true });
  addText(slide, planned.message, 72, 255, 700, 28, { fontSize: 15, color: COLOR.muted });
  const rowYs = [315, 396, 477, 558];
  planned.checks.forEach((check, index) => {
    const y = rowYs[index] ?? 315 + index * 72;
    addLine(slide, 72, y - 14, 696);
    addText(slide, check.label, 72, y + 5, 225, 26, { fontSize: 15, bold: true });
    addText(slide, `기준 ${check.criterion}`, 72, y + 36, 250, 22, { fontSize: 11, color: COLOR.muted });
    addText(slide, check.result, 330, y - 1, 308, 48, { fontSize: index === 3 ? 25 : 30, bold: true, align: 'right' });
    addText(slide, check.status.toLowerCase() === 'pass' ? '통과' : check.status, 666, y + 8, 102, 24, {
      fontSize: 12,
      bold: true,
      color: check.status.toLowerCase() === 'pass' ? COLOR.teal : COLOR.coral,
      align: 'right',
    });
  });
  addLine(slide, 72, 646, 696);
  slide.addShape('rect', { x: inch(832), y: inch(94), w: inch(376), h: inch(552), line: { color: COLOR.dark, transparency: 100 }, fill: { color: COLOR.dark } });
  addText(slide, 'Monte Carlo 검증', 872, 137, 296, 28, { fontSize: 15, bold: true, color: COLOR.tealSoft });
  addText(slide, planned.monteCarlo.passRate.startsWith('약') ? '약' : '', 872, 235, 60, 34, { fontSize: 18, color: COLOR.light });
  addText(slide, planned.monteCarlo.passRate.replace(/^약\s*/, ''), 872, 266, 296, 104, { fontSize: 69, bold: true, color: COLOR.light });
  addText(slide, `N = ${planned.monteCarlo.runs} 통과율`, 874, 380, 288, 34, { fontSize: 18, bold: true, color: COLOR.light });
  addLine(slide, 872, 441, 296, 0, '53605C');
  const parameterCount = /(\d+)개 파라미터/.exec(planned.monteCarlo.sampling)?.[1];
  const samplingRange = /(±\d+% 범위[^,이며.]*)/.exec(planned.monteCarlo.sampling)?.[1];
  addText(slide, `${parameterCount ?? '37'}개 파라미터`, 872, 470, 296, 28, { fontSize: 15, bold: true, color: COLOR.light });
  addText(slide, samplingRange ?? '±20% 범위에서 무작위 샘플링', 872, 504, 296, 34, { fontSize: 13, color: 'C9CECB' });
  addText(slide, '지수 민감 파라미터는\n절대 오프셋 범위를 별도 적용', 872, 552, 296, 54, { fontSize: 12, color: 'AEB7B3' });
  addFooter(slide, plan);
  setNotes(slide, plan, planned.sourceBlockIds);
}

export function createEditablePptx(plan: PresentationPlan): Presentation {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'GAME PPT DESIGNER NEXT';
  pptx.company = 'GAME PPT DESIGNER NEXT';
  pptx.subject = plan.sectionTitle;
  pptx.title = `${plan.projectTitle} · ${plan.sectionTitle}`;
  pptx.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
  };
  pptx.defineSlideMaster({
    title: 'EDITORIAL_BALANCE',
    background: { color: COLOR.paper },
    objects: [],
    slideNumber: { x: 0, y: 0, color: COLOR.paper },
  });

  plan.slides.forEach((planned, index) => {
    const slide = pptx.addSlide('EDITORIAL_BALANCE');
    slide.background = { color: COLOR.paper };
    if (planned.role === 'goal-definition') renderGoalSlide(slide, plan, planned, index + 1);
    else if (planned.role === 'tuning-ledger') renderTuningSlide(slide, plan, planned, index + 1);
    else renderValidationSlide(slide, plan, planned, index + 1);
  });
  return pptx;
}

export async function writeEditablePptx(plan: PresentationPlan, outputPath: string): Promise<string> {
  const absolute = path.resolve(outputPath);
  await createEditablePptx(plan).writeFile({ fileName: absolute });
  return absolute;
}
