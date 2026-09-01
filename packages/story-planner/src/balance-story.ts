import {
  PresentationPlanSchema,
  contentHash,
  type AuthoredBlock,
  type AuthoredDocument,
  type AuthoredSection,
  type ContentInventory,
  type PresentationPlan,
} from '@game-presentation/contracts';
import { buildContentInventory, findSectionByTitle } from '@game-presentation/source-ingestion';

type PlanResult = { inventory: ContentInventory; plan: PresentationPlan };

function requireSection(document: AuthoredDocument, title: string): AuthoredSection {
  const section = findSectionByTitle(document, title);
  if (section === undefined) throw new Error(`기획에 필요한 섹션을 찾지 못했습니다: ${title}`);
  return section;
}

function sectionBlocks(document: AuthoredDocument, section: AuthoredSection): AuthoredBlock[] {
  const ids = new Set(section.blockIds);
  return document.blocks.filter((block) => ids.has(block.id));
}

function firstTable(document: AuthoredDocument, section: AuthoredSection): Extract<AuthoredBlock, { kind: 'table' }> {
  const table = sectionBlocks(document, section).find(
    (block): block is Extract<AuthoredBlock, { kind: 'table' }> => block.kind === 'table',
  );
  if (table === undefined) throw new Error(`섹션에 표가 없습니다: ${section.title}`);
  return table;
}

function rowMap(table: Extract<AuthoredBlock, { kind: 'table' }>): ReadonlyMap<string, string[]> {
  return new Map(table.rows.slice(1).filter((row) => (row[0]?.length ?? 0) > 0).map((row) => [row[0]!, row]));
}

function findRow(rows: ReadonlyMap<string, string[]>, label: string): string[] {
  const normalized = label.replaceAll(/\s+/g, '').toLowerCase();
  const entry = [...rows.entries()].find(([key]) => key.replaceAll(/\s+/g, '').toLowerCase().includes(normalized));
  if (entry === undefined) throw new Error(`표에서 필요한 행을 찾지 못했습니다: ${label}`);
  return entry[1];
}

function textBlocks(document: AuthoredDocument, section: AuthoredSection): Array<Extract<AuthoredBlock, { kind: 'paragraph' }>> {
  return sectionBlocks(document, section).filter(
    (block): block is Extract<AuthoredBlock, { kind: 'paragraph' }> => block.kind === 'paragraph',
  );
}

function deduplicate(values: string[]): string[] {
  return [...new Set(values)];
}

function projectTitle(document: AuthoredDocument): string {
  const opening = document.blocks
    .filter((block): block is Extract<AuthoredBlock, { kind: 'paragraph' }> => block.kind === 'paragraph')
    .slice(0, 4)
    .map((block) => block.text)
    .join(' ');
  return /게임\s*-([^\-]+)-/.exec(opening)?.[1]?.trim() ?? '게임 프로젝트';
}

export function buildBalanceStory(input: { document: AuthoredDocument; createdAt?: string }): PlanResult {
  const goalSection = requireSection(input.document, '밸런스 설계 목표');
  const overviewSection = requireSection(input.document, '검증 개요');
  const validationSection = requireSection(input.document, '기본값 계산 결과');
  const tuningSection = requireSection(input.document, '튜닝 이력');
  const sectionIds = [goalSection.id, overviewSection.id, validationSection.id, tuningSection.id];
  const inventory = buildContentInventory({
    document: input.document,
    sectionIds,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  });

  const goalTable = firstTable(input.document, goalSection);
  const goals = goalTable.rows.slice(1).filter((row) => row.length >= 3).map((row) => ({
    axis: row[0]!,
    target: row[2]!,
    evidence: row[1]!,
    sourceBlockIds: [goalTable.id],
  }));

  const validationTable = firstTable(input.document, validationSection);
  const validationRows = rowMap(validationTable);
  const checkLabels = ['장비:캐릭터 비율', '보스 생존', '초반 TTK', '60일 골드'];
  const checks = checkLabels.map((label) => {
    const row = findRow(validationRows, label);
    return {
      label: row[0]!,
      criterion: row[1]!,
      result: row[2]!,
      status: row[3]!,
      sourceBlockIds: [validationTable.id],
    };
  });

  const tuningTable = firstTable(input.document, tuningSection);
  const header = tuningTable.rows[0] ?? [];
  const versions = header.slice(1, -1);
  const outcomeRules: Record<string, { checkLabel: string; outcomeLabel: string }> = {
    char_base_atk: { checkLabel: '초반 TTK', outcomeLabel: '초반 TTK' },
    equip_base: { checkLabel: '장비:캐릭터 비율', outcomeLabel: '장비 : 캐릭터' },
    mon_boss_atk: { checkLabel: '보스 생존', outcomeLabel: '보스 생존' },
  };
  const tuningRows = tuningTable.rows.slice(1)
    .filter((row) => row[0] !== undefined && outcomeRules[row[0]] !== undefined)
    .map((row) => {
      const parameter = row[0]!;
      const rule = outcomeRules[parameter]!;
      const check = checks.find((candidate) => candidate.label.replaceAll(/\s+/g, '').includes(rule.checkLabel.replaceAll(/\s+/g, '')));
      if (check === undefined) throw new Error(`튜닝 결과와 검증 행을 연결하지 못했습니다: ${parameter}`);
      return {
        parameter,
        values: row.slice(1, 1 + versions.length),
        reason: row.at(-1)!,
        outcomeLabel: rule.outcomeLabel,
        outcomeValue: check.result,
        sourceBlockIds: [tuningTable.id, ...check.sourceBlockIds],
      };
    });

  const monteParagraph = textBlocks(input.document, overviewSection).find(
    (block) => block.text.includes('Monte Carlo') && block.text.includes('통과율'),
  );
  if (monteParagraph === undefined) throw new Error('Monte Carlo 검증 근거를 찾지 못했습니다.');
  const runs = /N\s*=\s*([\d,]+)/.exec(monteParagraph.text)?.[1];
  const passRate = /통과율\s*(약\s*)?([\d.]+%)/.exec(monteParagraph.text);
  if (runs === undefined || passRate?.[2] === undefined) throw new Error('Monte Carlo 실행 횟수 또는 통과율을 읽지 못했습니다.');
  const rate = `${passRate[1] ?? ''}${passRate[2]}`.replaceAll(/\s+/g, ' ').trim();

  const sourceBlockIds = deduplicate([
    goalTable.id,
    tuningTable.id,
    validationTable.id,
    monteParagraph.id,
  ]);
  const planSeed = {
    documentId: input.document.documentId,
    sourceHash: input.document.source.contentHash,
    sourceBlockIds,
  };
  const plan = PresentationPlanSchema.parse({
    schemaVersion: '0.1',
    planId: `plan-${contentHash(planSeed).slice(0, 12)}`,
    documentId: input.document.documentId,
    sourceHash: input.document.source.contentHash,
    projectTitle: projectTitle(input.document),
    sectionTitle: '전투 밸런스 목표 설정과 검증',
    slideProfile: 'screen-16:9',
    author: 'deterministic-planner',
    slides: [
      {
        id: 'balance-goals',
        role: 'goal-definition',
        title: '속도감·성장감·보스 긴장감을 먼저 수치 목표로 고정했다',
        message: '목표값을 먼저 고정하고, 파라미터는 그 기준에 맞춰 조정한다.',
        layoutFamily: 'editorial-goal-columns',
        sourceBlockIds: [goalTable.id],
        goals,
      },
      {
        id: 'balance-tuning',
        role: 'tuning-ledger',
        title: '기준 파라미터를 조정해 초반 DPS·장비 비중·보스 생존을 맞췄다',
        message: '변경값과 변경 사유를 한 줄로 연결해 역추적할 수 있게 한다.',
        layoutFamily: 'editorial-tuning-ledger',
        sourceBlockIds: deduplicate([tuningTable.id, validationTable.id]),
        versions,
        rows: tuningRows,
      },
      {
        id: 'balance-validation',
        role: 'validation-summary',
        title: `최종값은 핵심 기준을 충족했고, ${runs}회 표본에서도 ${rate}가 통과했다`,
        message: '단일 정답이 아니라, 값이 흔들려도 유지되는 범위를 확인했다.',
        layoutFamily: 'editorial-validation-field',
        sourceBlockIds: deduplicate([validationTable.id, monteParagraph.id]),
        checks,
        monteCarlo: {
          runs,
          passRate: rate,
          sampling: monteParagraph.text,
          sourceBlockIds: [monteParagraph.id],
        },
      },
    ],
  });
  return { inventory, plan };
}
