import {
  AUTHORING_HARNESS_STATES,
  AuthoringRunTraceSchema,
  contentHash,
  sha256Text,
  type AIProvider,
  type AuthoringHarnessState,
  type AuthoringRunTrace,
  type CompositionPlan,
  type ExportHandle,
  type InformationDesignModeResolution,
  type InformationPlan,
  type RenderTree,
  type SlideIR,
  type StudioDesignInput,
  type StudioDesignOutput,
} from '@game-presentation/contracts';

export type HarnessHardGate = {
  passed: boolean;
  programFindingCount: number;
  sourceFidelityFindingCount: number;
  value: unknown;
};

export type HarnessExportResult = {
  output: StudioDesignOutput;
  pngPath: string;
  pngHash: string;
  exports: Array<ExportHandle & { path: string; hash?: string }>;
  metadata: Record<string, unknown>;
};

export type AuthoringHarnessContext = {
  input: StudioDesignInput;
  ingested?: unknown;
  slide?: SlideIR;
  informationPlanCandidate?: InformationPlan;
  informationPlan?: InformationPlan;
  mode?: StudioDesignInput['mode'];
  modeResolution?: InformationDesignModeResolution;
  retrieval?: unknown;
  teacherSelection?: unknown;
  selectedTeacherIds: string[];
  teacherGuidance?: unknown;
  compositionPlan?: CompositionPlan;
  renderTree?: RenderTree;
  renderRuntime?: unknown;
  hardGate?: HarnessHardGate;
  critic?: { reference: { requestId: string; provider: string; model: string }; value: unknown };
  exported?: HarnessExportResult;
};

/**
 * Domain ports keep the harness as a conductor. Implementations live in their owning packages;
 * the harness only passes artifacts between them and records state.
 */
export type AuthoringHarnessPorts = {
  ingest(input: StudioDesignInput): Promise<unknown> | unknown;
  interpret(context: AuthoringHarnessContext): Promise<{ slide: SlideIR; informationPlanCandidate: InformationPlan }> | { slide: SlideIR; informationPlanCandidate: InformationPlan };
  validateSemantic(context: AuthoringHarnessContext): Promise<void> | void;
  resolveMode(context: AuthoringHarnessContext): Promise<InformationDesignModeResolution> | InformationDesignModeResolution;
  designInformation(context: AuthoringHarnessContext): Promise<InformationPlan> | InformationPlan;
  retrieveReferences(context: AuthoringHarnessContext): Promise<unknown> | unknown;
  selectTeachers(context: AuthoringHarnessContext): Promise<{ selection: unknown; selectedTeacherIds: string[]; guidance: unknown }> | { selection: unknown; selectedTeacherIds: string[]; guidance: unknown };
  compose(context: AuthoringHarnessContext): Promise<CompositionPlan> | CompositionPlan;
  render(context: AuthoringHarnessContext): Promise<{ tree: RenderTree; runtime?: unknown }>;
  runHardGate(context: AuthoringHarnessContext): Promise<HarnessHardGate> | HarnessHardGate;
  runCritic?(context: AuthoringHarnessContext, provider: AIProvider): Promise<{ reference: { requestId: string; provider: string; model: string }; value: unknown }>;
  export(context: AuthoringHarnessContext): Promise<HarnessExportResult>;
  evaluate?(context: AuthoringHarnessContext): Promise<void> | void;
  dispose?(context: AuthoringHarnessContext): Promise<void> | void;
};

export type AuthoringHarnessRunOptions = {
  runId: string;
  ports: AuthoringHarnessPorts;
  criticProvider?: AIProvider;
  userDecision?: AuthoringRunTrace['userDecision'];
  onTrace?: (trace: AuthoringRunTrace) => Promise<void> | void;
};

export type AuthoringHarnessResult = {
  output: StudioDesignOutput;
  trace: AuthoringRunTrace;
  context: AuthoringHarnessContext;
};

export class AuthoringHarnessError extends Error {
  constructor(message: string, readonly trace: AuthoringRunTrace, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuthoringHarnessError';
  }
}

function now(): string {
  return new Date().toISOString();
}

async function publish(trace: AuthoringRunTrace, callback?: AuthoringHarnessRunOptions['onTrace']) {
  const parsed = AuthoringRunTraceSchema.parse(trace);
  await callback?.(parsed);
  return parsed;
}

function requireArtifact<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} artifact가 없습니다.`);
  return value;
}

export async function runAuthoringHarness(
  input: StudioDesignInput,
  options: AuthoringHarnessRunOptions,
): Promise<AuthoringHarnessResult> {
  const context: AuthoringHarnessContext = { input, selectedTeacherIds: [] };
  let trace: AuthoringRunTrace = AuthoringRunTraceSchema.parse({
    schemaVersion: '0.1',
    runId: options.runId,
    projectId: input.projectId,
    documentId: input.documentId,
    mode: input.mode,
    sourceHash: sha256Text(input.authoredContent),
    selectedTeacherIds: [],
    revisionCount: 0,
    exportArtifacts: [],
    startedAt: now(),
    currentState: 'INGEST',
    stages: [],
  });

  const execute = async <T>(state: AuthoringHarnessState, task: () => Promise<T> | T): Promise<T> => {
    const startedAt = now();
    trace = { ...trace, currentState: state };
    try {
      const result = await task();
      trace = AuthoringRunTraceSchema.parse({
        ...trace,
        stages: [...trace.stages, { state, status: 'completed', startedAt, completedAt: now() }],
      });
      trace = await publish(trace, options.onTrace);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      trace = AuthoringRunTraceSchema.parse({
        ...trace,
        currentState: state,
        stages: [...trace.stages, { state, status: 'failed', startedAt, completedAt: now(), reason }],
        failure: { state, reason },
        completedAt: now(),
      });
      await publish(trace, options.onTrace);
      throw new AuthoringHarnessError(reason, trace, { cause: error });
    }
  };

  const mark = async (state: AuthoringHarnessState, status: 'skipped' | 'awaiting-external-input', reason: string) => {
    const time = now();
    trace = AuthoringRunTraceSchema.parse({
      ...trace,
      currentState: state,
      stages: [...trace.stages, { state, status, startedAt: time, completedAt: time, reason }],
    });
    trace = await publish(trace, options.onTrace);
  };

  try {
    context.ingested = await execute('INGEST', () => options.ports.ingest(input));
    const interpreted = await execute('INTERPRET', () => options.ports.interpret(context));
    context.slide = interpreted.slide;
    context.informationPlanCandidate = interpreted.informationPlanCandidate;
    trace = { ...trace, slideIR: { id: context.slide.slideId, hash: contentHash(context.slide) } };

    await execute('SEMANTIC_VALIDATE', () => options.ports.validateSemantic(context));
    context.modeResolution = await execute('MODE_RESOLVE', () => options.ports.resolveMode(context));
    context.mode = context.modeResolution.mode;
    trace = {
      ...trace,
      mode: context.mode,
      modeResolution: { id: context.modeResolution.policyId, hash: contentHash(context.modeResolution) },
    };
    context.informationPlan = await execute('INFORMATION_DESIGN', () => options.ports.designInformation(context));
    trace = {
      ...trace,
      informationPlan: { id: context.informationPlan.informationPlanId, hash: contentHash(context.informationPlan) },
    };

    context.retrieval = await execute('REFERENCE_RETRIEVAL', () => options.ports.retrieveReferences(context));
    const teacher = await execute('TEACHER_SELECTION', () => options.ports.selectTeachers(context));
    context.teacherSelection = teacher.selection;
    context.selectedTeacherIds = teacher.selectedTeacherIds;
    context.teacherGuidance = teacher.guidance;
    trace = { ...trace, selectedTeacherIds: teacher.selectedTeacherIds };

    context.compositionPlan = await execute('COMPOSITION', () => options.ports.compose(context));
    trace = {
      ...trace,
      compositionPlan: { id: context.compositionPlan.planId, hash: contentHash(context.compositionPlan) },
    };

    const rendered = await execute('RENDER', () => options.ports.render(context));
    context.renderTree = rendered.tree;
    context.renderRuntime = rendered.runtime;
    trace = {
      ...trace,
      renderTree: {
        id: context.renderTree.renderTreeId,
        hash: contentHash(context.renderTree),
        deterministicFingerprint: context.renderTree.deterministicFingerprint,
      },
    };

    context.hardGate = await execute('HARD_GATE', async () => {
      const result = await options.ports.runHardGate(context);
      trace = {
        ...trace,
        hardGate: {
          passed: result.passed,
          programFindingCount: result.programFindingCount,
          sourceFidelityFindingCount: result.sourceFidelityFindingCount,
        },
      };
      if (!result.passed) throw new Error('Hard Gate 실패 결과는 다음 단계로 진행할 수 없습니다.');
      return result;
    });

    if (options.criticProvider !== undefined && options.ports.runCritic !== undefined) {
      context.critic = await execute('CRITIC_OPTIONAL', () => options.ports.runCritic!(context, options.criticProvider!));
      trace = { ...trace, criticRunReference: context.critic.reference };
    } else {
      await mark('CRITIC_OPTIONAL', 'skipped', '생성 요청에서 Critic을 요청하지 않았습니다. 별도 API로 실행할 수 있습니다.');
    }
    await mark('REVISION_OPTIONAL', 'skipped', '자동 revision은 R1에서 실행하지 않습니다.');
    if (options.userDecision === undefined) {
      await mark('USER_DECISION', 'awaiting-external-input', '최종 판단은 실제 결과를 본 사용자가 별도로 기록합니다.');
    } else {
      await execute('USER_DECISION', () => {
        trace = { ...trace, userDecision: options.userDecision };
      });
    }

    context.exported = await execute('EXPORT', () => options.ports.export(context));
    trace = {
      ...trace,
      renderedPng: { path: context.exported.pngPath, hash: context.exported.pngHash },
      exportArtifacts: context.exported.exports.map((artifact) => ({
        kind: artifact.kind,
        path: artifact.path,
        ...(artifact.hash === undefined ? {} : { hash: artifact.hash }),
        editable: artifact.editable,
      })),
    };

    if (options.ports.evaluate !== undefined && options.userDecision !== undefined) {
      await execute('EVALUATION', () => options.ports.evaluate!(context));
    } else {
      await mark('EVALUATION', 'skipped', '평가 기록은 사용자 판단이 제공된 뒤 별도 extension point에서 실행합니다.');
    }
    trace = AuthoringRunTraceSchema.parse({ ...trace, completedAt: now() });
    trace = await publish(trace, options.onTrace);
    return { output: context.exported.output, trace, context };
  } finally {
    await options.ports.dispose?.(context);
  }
}

function replaceStage(
  trace: AuthoringRunTrace,
  state: AuthoringHarnessState,
  status: 'completed' | 'skipped' | 'awaiting-external-input',
  reason?: string,
): AuthoringRunTrace {
  const existing = trace.stages.find((stage) => stage.state === state);
  const time = now();
  const record = {
    state,
    status,
    startedAt: existing?.startedAt ?? time,
    completedAt: time,
    ...(reason === undefined ? {} : { reason }),
  } as const;
  return AuthoringRunTraceSchema.parse({
    ...trace,
    stages: AUTHORING_HARNESS_STATES
      .flatMap((candidate) => candidate === state ? [record] : trace.stages.filter((stage) => stage.state === candidate)),
  });
}

export function recordCriticRun(
  trace: AuthoringRunTrace,
  reference: NonNullable<AuthoringRunTrace['criticRunReference']>,
): AuthoringRunTrace {
  return AuthoringRunTraceSchema.parse({
    ...replaceStage(trace, 'CRITIC_OPTIONAL', 'completed'),
    criticRunReference: reference,
  });
}

export function recordHarnessRevision(trace: AuthoringRunTrace, revisionReference: string): AuthoringRunTrace {
  if (trace.revisionCount >= 1) throw new Error('Harness revisionCount는 1을 초과할 수 없습니다.');
  return AuthoringRunTraceSchema.parse({
    ...replaceStage(trace, 'REVISION_OPTIONAL', 'completed'),
    revisionCount: 1,
    revisionReference,
  });
}

export function recordHarnessUserDecision(
  trace: AuthoringRunTrace,
  userDecision: NonNullable<AuthoringRunTrace['userDecision']>,
): AuthoringRunTrace {
  return AuthoringRunTraceSchema.parse({
    ...replaceStage(trace, 'USER_DECISION', 'completed'),
    userDecision,
  });
}

export function recordHarnessEvaluation(
  trace: AuthoringRunTrace,
  evaluation: { eventId: string; hash: string },
): AuthoringRunTrace {
  if (trace.userDecision === undefined) throw new Error('사용자 판단 없이 Evaluation을 완료할 수 없습니다.');
  return AuthoringRunTraceSchema.parse({
    ...replaceStage(trace, 'EVALUATION', 'completed'),
    evaluationReference: { id: evaluation.eventId, hash: evaluation.hash },
  });
}
