import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { contentHash, DesignEvaluationEventSchema, PreferenceEvidenceEventSchema } from '@game-presentation/contracts';
import { HumanEvaluationEvidenceSchema, HumanPreferenceEvidenceSchema, TrainingArtifactEnvelopeSchema, type HumanEvaluationEvidence, type HumanPreferenceEvidence, type TrainingArtifactEnvelope } from './production-contract.js';

async function sha256File(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function repositoryPath(repositoryRoot: string, path: string): string {
  const root = resolve(repositoryRoot);
  const target = resolve(path);
  if (target !== root && !target.startsWith(root + sep)) throw new Error('학습 evidence 경로가 저장소 밖을 가리킵니다.');
  return relative(root, target).replaceAll('\\', '/');
}

async function readJsonl<T>(path: string, parse: (value: unknown) => T): Promise<T[]> {
  try {
    return (await readFile(path, 'utf8')).split(/\r?\n/u).filter(Boolean).map((line) => parse(JSON.parse(line)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function artifactIdentity(output: TrainingArtifactEnvelope['output']): string {
  return contentHash({
    artifactId: output.artifactId,
    authoredContentHash: output.trace.authoredContentHash,
    pngSha256: output.trace.pngSha256,
    semanticShape: output.trace.semanticShape,
    renderTreeFingerprint: output.trace.renderTreeFingerprint,
  });
}

export class HumanTrainingEventStore {
  readonly evaluationsPath: string;
  readonly preferencesPath: string;

  constructor(readonly baseDir: string, readonly repositoryRoot: string) {
    this.evaluationsPath = resolve(baseDir, 'evaluations.jsonl');
    this.preferencesPath = resolve(baseDir, 'preferences.jsonl');
  }

  loadEvaluations(): Promise<HumanEvaluationEvidence[]> {
    return readJsonl(this.evaluationsPath, (value) => HumanEvaluationEvidenceSchema.parse(value));
  }

  loadPreferences(): Promise<HumanPreferenceEvidence[]> {
    return readJsonl(this.preferencesPath, (value) => HumanPreferenceEvidenceSchema.parse(value));
  }

  async appendEvaluation(rawEvent: unknown, metadataPath: string): Promise<{ inserted: boolean; evidence: HumanEvaluationEvidence }> {
    const sourceEvent = DesignEvaluationEventSchema.parse(rawEvent);
    if (sourceEvent.userDecision !== 'ready' && sourceEvent.userDecision !== 'reject') throw new Error('Ready Positive는 명시적인 사용자 ready 판단만 인정합니다.');
    const sourceEventHash = contentHash(sourceEvent);
    const current = await this.loadEvaluations();
    const existing = current.find((item) => item.sourceEvent.eventId === sourceEvent.eventId);
    if (existing !== undefined) {
      if (existing.sourceEventHash !== sourceEventHash) throw new Error('같은 evaluation eventId에 다른 내용이 들어왔습니다.');
      return { inserted: false, evidence: existing };
    }
    const metadata = TrainingArtifactEnvelopeSchema.parse(JSON.parse(await readFile(metadataPath, 'utf8')));
    const output = metadata.output;
    const pngPath = resolve(dirname(metadataPath), `${sourceEvent.artifactId}.png`);
    if (sourceEvent.artifactId !== output.artifactId || sourceEvent.png.sha256 !== output.trace.pngSha256 || sourceEvent.authoredContentHash !== output.trace.authoredContentHash || sourceEvent.semanticShape !== output.trace.semanticShape) throw new Error('평가와 artifact trace가 일치하지 않습니다.');
    if (await sha256File(pngPath) !== sourceEvent.png.sha256) throw new Error('평가 PNG hash가 실제 파일과 일치하지 않습니다.');
    const mode = metadata.input?.mode;
    if (mode !== 'document' && mode !== 'presentation') throw new Error('artifact mode를 확인할 수 없습니다.');
    const evidence = HumanEvaluationEvidenceSchema.parse({
      schemaVersion: '0.1', eventKind: 'evaluation', sourceEvent,
      sourceEventHash, explicitHumanDecision: true,
      artifact: {
        metadataPath: repositoryPath(this.repositoryRoot, metadataPath),
        artifactIdentitySha256: artifactIdentity(output),
        pngPath: repositoryPath(this.repositoryRoot, pngPath),
        pngSha256: sourceEvent.png.sha256,
        authoredContentHash: output.trace.authoredContentHash,
        semanticShape: output.trace.semanticShape,
        mode,
        renderTreeFingerprint: output.trace.renderTreeFingerprint,
      },
    });
    await mkdir(this.baseDir, { recursive: true });
    await appendFile(this.evaluationsPath, `${JSON.stringify(evidence)}\n`, 'utf8');
    return { inserted: true, evidence };
  }

  async appendPreference(rawEvent: unknown, metadataPath: string): Promise<{ inserted: boolean; evidence: HumanPreferenceEvidence }> {
    const sourceEvent = PreferenceEvidenceEventSchema.parse(rawEvent);
    const sourceEventHash = contentHash(sourceEvent);
    const current = await this.loadPreferences();
    const existing = current.find((item) => item.sourceEvent.eventId === sourceEvent.eventId);
    if (existing !== undefined) {
      if (existing.sourceEventHash !== sourceEventHash) throw new Error('같은 preference eventId에 다른 내용이 들어왔습니다.');
      return { inserted: false, evidence: existing };
    }
    const metadata = TrainingArtifactEnvelopeSchema.parse(JSON.parse(await readFile(metadataPath, 'utf8')));
    const output = metadata.output;
    if (sourceEvent.artifactId !== output.artifactId || sourceEvent.comparisonId !== output.comparisonId) throw new Error('선호 기록과 artifact가 일치하지 않습니다.');
    if (sourceEvent.semanticShape !== output.trace.semanticShape || sourceEvent.mode !== metadata.input?.mode) throw new Error('선호 기록과 artifact 구조가 일치하지 않습니다.');
    const outputCandidateIds = output.candidates.map((candidate) => candidate.candidateId).sort();
    if (JSON.stringify([...sourceEvent.candidateIds].sort()) !== JSON.stringify(outputCandidateIds)) throw new Error('선호 후보 목록과 artifact 후보 목록이 일치하지 않습니다.');
    const candidateArtifacts = metadata.candidates ?? [];
    const candidates = await Promise.all(output.candidates.map(async (candidate) => {
      const stored = candidateArtifacts.find((item) => item.candidateId === candidate.candidateId);
      const pngPath = typeof stored?.pngPath === 'string' ? stored.pngPath : resolve(dirname(metadataPath), `${output.artifactId}.png`);
      if (candidate.pngSha256 !== (typeof stored?.pngHash === 'string' ? stored.pngHash : candidate.pngSha256)) throw new Error('candidate metadata hash가 일치하지 않습니다.');
      if (await sha256File(pngPath) !== candidate.pngSha256) throw new Error('candidate PNG hash가 실제 파일과 일치하지 않습니다.');
      return { candidateId: candidate.candidateId, pngPath: repositoryPath(this.repositoryRoot, pngPath), pngSha256: candidate.pngSha256 };
    }));
    if (sourceEvent.selectedCandidateId !== null) {
      const selected = candidates.find((candidate) => candidate.candidateId === sourceEvent.selectedCandidateId);
      if (selected === undefined || sourceEvent.selectedCandidateHash !== selected.pngSha256) throw new Error('선택한 candidate hash가 artifact와 일치하지 않습니다.');
    } else if (sourceEvent.selectedCandidateHash !== null) throw new Error('reject-all 선호에는 selected candidate hash가 없어야 합니다.');
    const evidence = HumanPreferenceEvidenceSchema.parse({
      schemaVersion: '0.1', eventKind: 'preference', sourceEvent,
      sourceEventHash,
      artifact: {
        metadataPath: repositoryPath(this.repositoryRoot, metadataPath),
        artifactIdentitySha256: artifactIdentity(output),
        authoredContentHash: output.trace.authoredContentHash,
        candidates,
      },
    });
    await mkdir(this.baseDir, { recursive: true });
    await appendFile(this.preferencesPath, `${JSON.stringify(evidence)}\n`, 'utf8');
    return { inserted: true, evidence };
  }
}
