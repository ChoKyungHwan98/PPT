import { describe, expect, it } from 'vitest';
import {
  AUTHORING_HARNESS_STATES,
  FakeAIProvider,
  resolveInformationDesignMode,
  StudioDesignInputSchema,
  StudioDesignOutputSchema,
  contentHash,
  type StudioDesignInput,
} from '@game-presentation/contracts';
import {
  AuthoringHarnessError,
  recordHarnessRevision,
  runAuthoringHarness,
  type AuthoringHarnessPorts,
} from '../src/index.js';

const input = StudioDesignInputSchema.parse({
  schemaVersion: '0.1',
  projectId: 'project-test',
  documentId: 'document-test',
  mode: 'document',
  authoredContent: '제목: 보상 구조 개선\n기존 보상 구조:\n- 상자 1개\n개선 보상 구조:\n- 상자 2개\n메시지: 목표에 맞는 보상을 선택한다',
  authoredStructure: 'aligned-before-after-spec',
  outputProfile: 'screen-16:9',
});

function fakePorts(calls: string[], hardGatePassed = true): AuthoringHarnessPorts {
  const slide = {
    slideId: 'slide-test',
    source: { rawText: input.authoredContent },
  } as never;
  const informationPlan = { informationPlanId: 'information-test' } as never;
  const compositionPlan = { planId: 'composition-test' } as never;
  const renderTree = {
    renderTreeId: 'render-test',
    deterministicFingerprint: 'a'.repeat(64),
  } as never;
  return {
    ingest() { calls.push('ingest'); return { syntax: 'fixture' }; },
    interpret() { calls.push('interpret'); return { slide, informationPlanCandidate: informationPlan }; },
    validateSemantic() { calls.push('semantic'); },
    resolveMode() { calls.push('mode'); return resolveInformationDesignMode('document'); },
    designInformation() { calls.push('information'); return informationPlan; },
    retrieveReferences() { calls.push('retrieval'); return { ids: ['reference-1'] }; },
    selectTeachers() {
      calls.push('teacher');
      return { selection: { selected: ['teacher-1'] }, selectedTeacherIds: ['teacher-1'], guidance: { primary: 'teacher-1' } };
    },
    compose() { calls.push('composition'); return compositionPlan; },
    async render() { calls.push('render'); return { tree: renderTree }; },
    runHardGate() {
      calls.push('hard-gate');
      return {
        passed: hardGatePassed,
        programFindingCount: hardGatePassed ? 0 : 1,
        sourceFidelityFindingCount: 0,
        value: { passed: hardGatePassed },
      };
    },
    async runCritic() {
      calls.push('critic');
      return { reference: { requestId: 'critic-1', provider: 'fake', model: 'fake-vision' }, value: {} };
    },
    async export() {
      calls.push('export');
      const output = StudioDesignOutputSchema.parse({
        schemaVersion: '0.1', artifactId: 'artifact-test', projectId: input.projectId, documentId: input.documentId,
        previewPngUrl: 'http://localhost/artifact.png',
        exports: [
          { kind: 'png', url: 'http://localhost/artifact.png', editable: false },
          { kind: 'html', url: 'http://localhost/artifact.html', editable: false },
          { kind: 'pdf', url: 'http://localhost/artifact.pdf', editable: false },
          { kind: 'pptx', url: 'http://localhost/artifact.pptx', editable: true },
        ],
        validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 },
        critic: null, readiness: 'not-reviewed',
        trace: {
          semanticShape: 'comparison', selectedTeacherIds: ['teacher-1'], appliedGuidanceIds: ['guidance-1'],
          renderTreeFingerprint: 'a'.repeat(64), authoredContentHash: 'b'.repeat(64), pngSha256: 'c'.repeat(64),
        },
      });
      return {
        output,
        pngPath: 'artifact.png',
        pngHash: 'c'.repeat(64),
        exports: output.exports.map((item) => ({ ...item, path: item.url })),
        metadata: {},
      };
    },
  };
}

describe('Authoring Harness', () => {
  it('records the canonical normal pipeline state transition', async () => {
    const calls: string[] = [];
    const result = await runAuthoringHarness(input, { runId: 'run-normal', ports: fakePorts(calls) });
    expect(result.trace.stages.map((stage) => stage.state)).toEqual(AUTHORING_HARNESS_STATES);
    expect(result.trace.stages.find((stage) => stage.state === 'USER_DECISION')?.status).toBe('awaiting-external-input');
    expect(result.trace.stages.find((stage) => stage.state === 'CRITIC_OPTIONAL')?.status).toBe('skipped');
    expect(result.trace.currentState).toBe('EVALUATION');
    expect(calls).toEqual(['ingest', 'interpret', 'semantic', 'mode', 'information', 'retrieval', 'teacher', 'composition', 'render', 'hard-gate', 'export']);
  });

  it('stops on Hard Gate FAIL and never calls Critic or Export', async () => {
    const calls: string[] = [];
    let failure: AuthoringHarnessError | undefined;
    try {
      await runAuthoringHarness(input, {
        runId: 'run-fail',
        ports: fakePorts(calls, false),
        criticProvider: new FakeAIProvider('fake-vision', new Map()),
      });
    } catch (error) {
      failure = error as AuthoringHarnessError;
    }
    expect(failure).toBeInstanceOf(AuthoringHarnessError);
    expect(failure?.trace.currentState).toBe('HARD_GATE');
    expect(failure?.trace.failure?.state).toBe('HARD_GATE');
    expect(failure?.trace.hardGate?.passed).toBe(false);
    expect(calls).not.toContain('critic');
    expect(calls).not.toContain('export');
  });

  it('cannot record more than one revision', async () => {
    const result = await runAuthoringHarness(input, { runId: 'run-revision', ports: fakePorts([]) });
    const revised = recordHarnessRevision(result.trace, 'revision-proof-1');
    expect(revised.revisionCount).toBe(1);
    expect(() => recordHarnessRevision(revised, 'revision-proof-2')).toThrow(/1을 초과/u);
  });

  it('tracks an optional Critic run without owning its prompt or provider policy', async () => {
    const result = await runAuthoringHarness(input, {
      runId: 'run-critic',
      ports: fakePorts([]),
      criticProvider: new FakeAIProvider('fake-vision', new Map()),
    });
    expect(result.trace.criticRunReference).toEqual({ requestId: 'critic-1', provider: 'fake', model: 'fake-vision' });
    expect(result.trace.stages.find((stage) => stage.state === 'CRITIC_OPTIONAL')?.status).toBe('completed');
  });

  it('links each artifact trace to the artifact created by the previous domain stage', async () => {
    const result = await runAuthoringHarness(input, { runId: 'run-artifacts', ports: fakePorts([]) });
    expect(result.trace.sourceHash).toHaveLength(64);
    expect(result.trace.modeResolution?.id).toBe('document-information-design-v1');
    expect(result.trace.slideIR).toEqual({ id: 'slide-test', hash: contentHash(result.context.slide) });
    expect(result.trace.informationPlan).toEqual({ id: 'information-test', hash: contentHash(result.context.informationPlan) });
    expect(result.trace.selectedTeacherIds).toEqual(['teacher-1']);
    expect(result.trace.compositionPlan).toEqual({ id: 'composition-test', hash: contentHash(result.context.compositionPlan) });
    expect(result.trace.renderTree?.deterministicFingerprint).toBe('a'.repeat(64));
    expect(result.trace.renderedPng?.hash).toBe('c'.repeat(64));
    expect(result.trace.exportArtifacts.map((item) => item.kind)).toEqual(['png', 'html', 'pdf', 'pptx']);
  });
});
