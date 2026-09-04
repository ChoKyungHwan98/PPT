import { describe, expect, it } from 'vitest';
import {
  FakeAIProvider,
  VisualCriticFixtureSchema,
  VisualCritiqueReportSchema,
  type AIProvider,
  type ProviderRequest,
} from '@game-presentation/contracts';
import { createMec01InformationPlan, interpretMec01Source } from '../../source-ingestion/src/mec-01-semantic.js';
import type { HardGateResult } from '../src/hard-gate.js';
import {
  benchmarkCriticReport,
  criticGuardrailIssues,
  runVisualCritic,
} from '../src/visual-critic.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

function passedGate(): HardGateResult {
  return { passed: true, programFindings: [], sourceFidelityFindings: [], findings: [] };
}

function report(artifactId: string) {
  return VisualCritiqueReportSchema.parse({
    schemaVersion: '0.1',
    artifactId,
    firstFixation: { target: 'BREAK', assessment: '전환점으로 먼저 보인다.' },
    readingPathAssessment: '왼쪽에서 오른쪽으로 자연스럽다.',
    submissionReadiness: 'not-ready',
    findings: [{
      findingId: 'finding-density',
      issueType: 'density',
      severity: 'error',
      target: { kind: 'page', ids: ['page'] },
      problem: '다섯 단계가 중앙의 좁은 영역에 몰려 있다.',
      reason: '단계 사이의 구분과 전환점 인지가 늦어진다.',
      revisionDirection: '각 단계 사이의 가로 간격을 늘리고 buildup과 결과 영역을 분리한다.',
    }],
    sourceChangeSuggested: false,
    hardGateStatus: 'passed',
  });
}

describe('visual critic benchmark', () => {
  it('matches human-labelled core issue and checks suggestion specificity', () => {
    const fixture = VisualCriticFixtureSchema.parse({
      schemaVersion: '0.1',
      fixtureId: 'density-problem',
      title: '정보 과밀',
      artifactId: 'render-density',
      labelCoverage: 'core-only',
      expectedFindings: [{
        issueType: 'density',
        acceptableIssueTypes: ['grouping'],
        severity: 'error',
        target: { kind: 'page', ids: ['page'] },
        humanReason: '중앙에 정보가 몰려 있다.',
      }],
      expectedSubmissionReadiness: 'not-ready',
    });
    const result = benchmarkCriticReport(fixture, report('render-density'));
    expect(result.problemRecall).toBe(1);
    expect(result.falsePositiveCount).toBeNull();
    expect(result.unmatchedActionableCount).toBe(0);
    expect(result.severityExactCount).toBe(1);
    expect(result.specificSuggestionCount).toBe(1);
  });

  it('requires exact ready calibration and zero findings on the approved positive fixture', () => {
    const fixture = VisualCriticFixtureSchema.parse({
      schemaVersion: '0.1',
      fixtureId: 'user-approved-positive',
      title: '사람이 승인한 정상 결과',
      artifactId: 'render-user-approved',
      labelCoverage: 'exhaustive',
      expectedFindings: [],
      expectedSubmissionReadiness: 'ready',
      positiveAudit: {
        hierarchyClear: true,
        readingOrderClear: true,
        spaceUseAppropriate: true,
        groupingClear: true,
        typographyHierarchyAppropriate: true,
        relationClear: true,
        decorationNonInterfering: true,
        notPrototypeLike: true,
        humanReason: '사람이 실제 제출 가능한 결과로 승인했다.',
        evidenceIds: ['golden.png'],
        userApproval: {
          approvalId: 'approval-user-001',
          approvedBy: 'user',
          approvedArtifactId: 'render-user-approved',
          approvedAt: '2026-09-02T00:00:00.000Z',
          approvalStatement: '이 이미지를 실제 제출 가능한 ready 기준으로 승인한다.',
        },
      },
    });
    const cleanReport = VisualCritiqueReportSchema.parse({
      schemaVersion: '0.1',
      artifactId: 'render-user-approved',
      firstFixation: { target: 'BREAK', assessment: '핵심 전환점으로 보인다.' },
      readingPathAssessment: '순서가 명확하다.',
      submissionReadiness: 'ready',
      findings: [],
      sourceChangeSuggested: false,
      hardGateStatus: 'passed',
    });
    expect(benchmarkCriticReport(fixture, cleanReport).positiveFixturePassed).toBe(true);

    const underCalibrated = { ...cleanReport, submissionReadiness: 'needs-review' as const };
    const failed = benchmarkCriticReport(fixture, underCalibrated);
    expect(failed.readinessMatched).toBe(false);
    expect(failed.positiveFixturePassed).toBe(false);
    expect(failed.fixturePassed).toBe(false);
  });

  it('rejects a ready fixture without a matching user approval record', () => {
    expect(() => VisualCriticFixtureSchema.parse({
      schemaVersion: '0.1',
      fixtureId: 'unapproved-positive',
      title: '승인 없는 후보',
      artifactId: 'render-unapproved',
      labelCoverage: 'exhaustive',
      expectedFindings: [],
      expectedSubmissionReadiness: 'ready',
    })).toThrow('ready fixture에는 사람의 제출 승인 audit가 필요합니다.');
  });

  it('flags source-copy changes and generic revision language', () => {
    const unsafe = report('render-density');
    unsafe.findings[0]!.revisionDirection = '원문을 수정하고 전반적으로 개선한다.';
    expect(criticGuardrailIssues(unsafe)).toHaveLength(2);
  });
});

describe('visual critic execution boundary', () => {
  it('never sends a Hard Gate FAIL render to a provider', async () => {
    const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
    const provider = new FakeAIProvider('fixture-model', new Map());
    await expect(runVisualCritic({
      provider,
      pngBytes: new Uint8Array([1, 2, 3]),
      artifactId: 'render-fail',
      goal: '순서와 전환점을 보여준다.',
      slide,
      informationPlan: createMec01InformationPlan(slide),
      hardGate: { passed: false, programFindings: [], sourceFidelityFindings: [], findings: [] },
    })).rejects.toThrow('Hard Gate FAIL');
  });

  it('hands off only the allowlisted compact context and actual PNG', async () => {
    const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
    let captured: ProviderRequest | undefined;
    const provider: AIProvider = {
      kind: 'fake',
      model: 'capturing-fixture',
      async capabilities() {
        return { structuredOutput: true, vision: true, localExecution: true, promptCaching: false };
      },
      async generateStructured(request, schema) {
        captured = request;
        return {
          value: schema.parse({
            artifactId: 'render-compact',
            firstFixation: { target: 'BREAK', assessment: '전환점으로 보인다.' },
            readingPathAssessment: '좌에서 우로 읽힌다.',
            submissionReadiness: 'ready',
            findings: [],
            sourceChangeSuggested: false,
            hardGateStatus: 'passed',
          }),
          run: {
            requestId: request.requestId,
            provider: 'fake',
            model: 'capturing-fixture',
            cacheHit: false,
            inputBytes: 1,
            outputBytes: 1,
            estimatedCostUsd: 0,
            contextArtifactIds: request.contextArtifactIds ?? [],
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(0).toISOString(),
          },
        };
      },
    };
    const result = await runVisualCritic({
      provider,
      pngBytes: new Uint8Array([1, 2, 3, 4]),
      artifactId: 'render-compact',
      goal: '순서와 전환점을 보여준다.',
      slide,
      informationPlan: createMec01InformationPlan(slide),
      hardGate: passedGate(),
      rubricIds: ['space-use', 'grouping'],
    });
    expect(captured?.imageEvidence?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(Object.keys(captured?.compactState as object)).toEqual([
      'artifactId',
      'pageGoal',
      'semanticSummary',
      'informationPlan',
      'rubric',
      'submissionReadinessAnchors',
      'hardGate',
    ]);
    expect(JSON.stringify(captured?.compactState)).not.toContain('repository');
    expect((captured?.compactState as { rubric: Array<{ id: string }> }).rubric.map((item) => item.id))
      .toEqual(['grouping', 'space-use']);
    expect(result.inputTrace.includedFields).toHaveLength(7);
  });
});
