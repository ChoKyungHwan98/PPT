import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  TeacherPageRecordSetSchema,
  type TeacherPageRecordSet,
} from '@game-presentation/contracts';

const ExternalMasterReferenceSchema = z.strictObject({
  referenceId: z.string().min(1),
  file: z.string().regex(/^[^/\\]+\.png$/u),
  source: z.strictObject({
    origin: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }),
  grammar: z.string().min(1),
  whySelected: z.string().min(1),
  readyGolden: z.literal(false),
  informationStructure: z.strictObject({
    question: z.string().min(1),
    pageGoal: z.string().min(1),
    coreClaim: z.string().min(1),
    informationUnits: z.array(z.strictObject({
      id: z.string().min(1),
      role: z.string().min(1),
      description: z.string().min(1),
    })).min(2),
    relations: z.array(z.strictObject({
      from: z.string().min(1),
      to: z.string().min(1),
      type: z.string().min(1),
      explanation: z.string().min(1),
    })).min(1),
    gameDesignGrammar: z.string().min(1),
  }),
  visualGrammar: z.strictObject({
    firstFixation: z.string().min(1),
    hierarchy: z.array(z.string().min(1)).min(2),
    readingPath: z.string().min(1),
    grouping: z.string().min(1),
    spaceDivision: z.string().min(1),
    emphasis: z.string().min(1),
    relationAndAnnotation: z.string().min(1),
    imageTextRoles: z.string().min(1),
    colorSemantics: z.string().min(1),
  }),
  whyItWorks: z.array(z.string().min(1)).min(1),
  applicability: z.strictObject({
    useWhen: z.array(z.string().min(1)).min(1),
    requiredInputs: z.array(z.string().min(1)).min(1),
  }),
  avoidBoundary: z.array(z.string().min(1)).min(1),
  surfaceStyleExclusions: z.array(z.string().min(1)).min(1),
  patternAssessment: z.strictObject({
    overlapWithExisting: z.array(z.string().min(1)),
    differenceFromExisting: z.string().min(1),
    promotionStatus: z.literal('candidate-only'),
    candidateName: z.string().min(1),
    rationale: z.string().min(1),
  }),
});

/**
 * External Master 분석 파일이 작성된 당시의 workflow snapshot이다.
 * 현재 프로젝트 stage, Teacher status, Retrieval, scoring, production context의 입력이 아니다.
 * `stageState`라는 legacy field 이름은 source evidence 호환을 위해 유지한다.
 */
const HistoricalExternalMasterWorkflowSnapshotSchema = z.strictObject({
  stage0: z.literal('partial'),
  stage6: z.literal('incomplete'),
  readyPositiveFixture: z.literal('none'),
  stage7: z.literal('not-started'),
  criticCalled: z.literal(false),
});

export const ExternalMasterReferenceSetSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  collectionId: z.string().min(1),
  purpose: z.string().min(1),
  status: z.literal('reference-only'),
  readyGolden: z.literal(false),
  sourceArchive: z.string().min(1),
  sourceFiles: z.strictObject({
    manifest: z.literal('manifest.json'),
    readme: z.literal('README.md'),
  }),
  rights: z.strictObject({
    status: z.literal('unknown'),
    allowedUse: z.strictObject({
      analyze: z.literal(true),
      deriveAbstractPrinciple: z.literal(true),
      reuseAsset: z.literal(false),
      redistributeAsset: z.literal(false),
    }),
  }),
  boundaries: z.array(z.string().min(1)).min(1),
  references: z.array(ExternalMasterReferenceSchema).length(6),
  v1Assessment: z.strictObject({
    semanticStructure: z.string().min(1),
    rankedReferenceGrammars: z.array(z.strictObject({
      rank: z.number().int().min(1).max(6),
      referenceId: z.string().min(1),
      fit: z.enum(['partial', 'low', 'not-applicable']),
      reason: z.string().min(1),
    })).length(6),
    thresholdFieldDifference: z.string().min(1),
    editorialCausalSpineDifference: z.string().min(1),
    rendererDiagnosis: z.array(z.string().min(1)).min(1),
    recommendedPatternCandidate: z.strictObject({
      name: z.string().min(1),
      status: z.enum(['candidate-only', 'implemented-v1-pattern']),
      reason: z.string().min(1),
      derivedFromPrinciples: z.array(z.string().min(1)).min(1),
    }),
  }),
  // Historical source snapshot only. Never interpret this as the current workflow state.
  stageState: HistoricalExternalMasterWorkflowSnapshotSchema,
});

export type ExternalMasterReferenceSet = z.infer<typeof ExternalMasterReferenceSetSchema>;

type SourceManifest = {
  status?: string;
  references?: Array<{
    file?: string;
    origin?: string;
    year?: number;
    grammar?: string;
    whySelected?: string;
    readyGolden?: boolean;
    sha256?: string;
  }>;
};

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * 사용자 제공 External Master 묶음을 로드하고 원본 manifest 및 이미지 hash와 대조한다.
 * 이 함수는 External Reference 원본을 ready Golden으로 승격하지 않는다.
 * 분석에서 사용자 승인된 추상 Pattern의 구현 상태만 기록할 수 있다.
 */
export async function loadExternalMasterReferenceSet(baseDir: string): Promise<ExternalMasterReferenceSet> {
  const analysis = ExternalMasterReferenceSetSchema.parse(
    JSON.parse(await readFile(join(baseDir, 'analysis.json'), 'utf8')),
  );
  const manifest = JSON.parse(await readFile(join(baseDir, analysis.sourceFiles.manifest), 'utf8')) as SourceManifest;
  await readFile(join(baseDir, analysis.sourceFiles.readme), 'utf8');
  if (manifest.status !== 'reference-only') {
    throw new Error('External Master source manifest는 reference-only여야 합니다.');
  }
  const manifestByFile = new Map((manifest.references ?? []).map((reference) => [reference.file, reference]));
  if (manifestByFile.size !== analysis.references.length) {
    throw new Error('External Master source manifest와 분석 reference 수가 다릅니다.');
  }
  for (const reference of analysis.references) {
    const source = manifestByFile.get(reference.file);
    if (source === undefined) throw new Error(`source manifest에 reference가 없습니다: ${reference.file}`);
    if (source.origin !== reference.source.origin
      || source.year !== reference.source.year
      || source.grammar !== reference.grammar
      || source.whySelected !== reference.whySelected
      || source.readyGolden !== false) {
      throw new Error(`source manifest metadata와 분석 metadata가 다릅니다: ${reference.file}`);
    }
    const actualHash = sha256(new Uint8Array(await readFile(join(baseDir, reference.file))));
    if (actualHash !== reference.source.sha256 || actualHash !== source.sha256) {
      throw new Error(`External Master 이미지 hash가 다릅니다: ${reference.file}`);
    }
  }
  return analysis;
}

/**
 * External Master 분석의 V1 Teacher sidecar를 로드하고 원본 provenance와 대조한다.
 * 이 단계는 Teacher를 검색하거나 curated-teacher로 승격하지 않는다.
 */
export async function loadExternalMasterTeacherPageSet(baseDir: string): Promise<TeacherPageRecordSet> {
  const teacherSet = TeacherPageRecordSetSchema.parse(
    JSON.parse(await readFile(join(baseDir, 'teacher-pages.v1.json'), 'utf8')),
  );
  const sourceSet = await loadExternalMasterReferenceSet(baseDir);
  if (teacherSet.collectionId !== sourceSet.collectionId
    || teacherSet.sourceAnalysisFile !== 'analysis.json'
    || teacherSet.pages.length !== sourceSet.references.length) {
    throw new Error('Teacher sidecar와 External Master source collection이 일치하지 않습니다.');
  }

  const sourceById = new Map(sourceSet.references.map((reference) => [reference.referenceId, reference]));
  for (const page of teacherSet.pages) {
    const source = sourceById.get(page.provenance.referenceId);
    if (source === undefined) {
      throw new Error(`External Master 분석에 없는 Teacher reference입니다: ${page.provenance.referenceId}`);
    }
    if (page.provenance.source.origin !== source.source.origin
      || page.provenance.year !== source.source.year
      || page.provenance.pageArtifact.localAssetPath !== source.file
      || page.provenance.pageArtifact.sourceSha256 !== source.source.sha256) {
      throw new Error(`Teacher provenance와 External Master 분석이 다릅니다: ${page.provenance.referenceId}`);
    }
    if (page.provenance.teacherStatus !== 'seed-evidence'
      || page.provenance.compatibility.legacyReadyGolden !== source.readyGolden) {
      throw new Error(`External Master seed의 status 또는 compatibility 값이 올바르지 않습니다: ${page.provenance.referenceId}`);
    }
    if (page.provenance.rights.status !== sourceSet.rights.status
      || page.provenance.rights.analyzeAllowed !== sourceSet.rights.allowedUse.analyze
      || page.provenance.rights.deriveAbstractPrincipleAllowed
        !== sourceSet.rights.allowedUse.deriveAbstractPrinciple
      || page.provenance.rights.reuseAssetAllowed !== sourceSet.rights.allowedUse.reuseAsset
      || page.provenance.rights.redistributeAssetAllowed !== sourceSet.rights.allowedUse.redistributeAsset) {
      throw new Error(`Teacher rights와 External Master source rights가 다릅니다: ${page.provenance.referenceId}`);
    }
  }
  return teacherSet;
}
