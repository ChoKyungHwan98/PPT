import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DesignProfileSchema,
  PreferenceEvidenceEventSchema,
  PreferencePatternSchema,
  contentHash,
  type DesignProfile,
  type PreferenceEvidenceEvent,
  type PreferencePattern,
} from '@game-presentation/contracts';

export class PreferenceEvidenceStore {
  private readonly path: string;
  constructor(private readonly baseDir: string) { this.path = join(baseDir, 'preference-events.v1.jsonl'); }

  async load(): Promise<PreferenceEvidenceEvent[]> {
    let text: string;
    try { text = await readFile(this.path, 'utf8'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return text.split(/\r?\n/u).filter(Boolean).map((line) => PreferenceEvidenceEventSchema.parse(JSON.parse(line)));
  }

  async append(raw: PreferenceEvidenceEvent): Promise<PreferenceEvidenceEvent> {
    const event = PreferenceEvidenceEventSchema.parse(raw);
    const current = await this.load();
    if (current.some((candidate) => candidate.eventId === event.eventId)) throw new Error('이미 저장된 preference evidence입니다.');
    await mkdir(this.baseDir, { recursive: true });
    await appendFile(this.path, JSON.stringify(event) + '\n', 'utf8');
    return event;
  }
}

export function promotePreferencePatterns(events: readonly PreferenceEvidenceEvent[]): PreferencePattern[] {
  const validated = events.map((event) => PreferenceEvidenceEventSchema.parse(event));
  const contexts = new Map<string, PreferenceEvidenceEvent[]>();
  for (const event of validated) {
    const key = contentHash({ semanticShape: event.semanticShape, mode: event.mode, domain: event.domain });
    contexts.set(key, [...(contexts.get(key) ?? []), event]);
  }
  return [...contexts.entries()].map(([contextKey, contextEvents]) => {
    const counts = new Map<string, number>();
    for (const event of contextEvents) {
      const outcome = event.chosenPatternId ?? 'reject-all';
      counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
    }
    const [outcome, consistentCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
    const confidence = consistentCount / contextEvents.length;
    const strength = contextEvents.length < 3 ? 'weak' : contextEvents.length >= 5 && confidence >= 0.8 ? 'established' : 'emerging';
    return PreferencePatternSchema.parse({
      patternKey: `${contextKey}:${outcome}`, semanticShape: contextEvents[0]!.semanticShape, mode: contextEvents[0]!.mode, outcome,
      evidenceCount: contextEvents.length, consistentCount, confidence, strength, sourceEventIds: contextEvents.map((event) => event.eventId),
    });
  });
}

export function buildDesignProfile(patterns: readonly PreferencePattern[], generatedAt: string): DesignProfile | null {
  const established = patterns.filter((pattern) => pattern.strength === 'established');
  if (established.length === 0) return null;
  return DesignProfileSchema.parse({
    schemaVersion: '0.1', profileId: `design-profile-${contentHash(established).slice(0, 12)}`,
    establishedPatternKeys: established.map((pattern) => pattern.patternKey),
    preferredPatternIds: established.map((pattern) => pattern.outcome).filter((outcome) => outcome !== 'reject-all'),
    boundaries: { hardGateOverride: false, sourceFidelityOverride: false, teacherQualityOverride: false }, generatedAt,
  });
}
