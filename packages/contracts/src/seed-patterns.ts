import { PatternFragmentSchema, type PatternFragment } from './reference.js';

export const SEED_PATTERN_FRAGMENTS: PatternFragment[] = [
  PatternFragmentSchema.parse({
    schemaVersion: '0.1',
    fragmentId: 'pattern-editorial-causal-spine',
    sourceReferenceIds: ['ref-oh-my-ppt-layout', 'ref-marp-reproducible'],
    abstractionLevel: 'structural',
    compatibleIntents: ['mechanism', 'timeline'],
    semanticShape: 'causal-chain',
    relationshipShape: ['produces', 'enables', 'transitions-to', 'causes'],
    readingPath: 'left-to-right',
    densityBand: 'balanced',
    primaryArtifactRole: 'mechanism-flow',
    topology: {
      family: 'editorial-causal-spine',
      orderedRoles: ['trigger', 'input', 'process', 'primary', 'modifier'],
      emphasisRule: 'Reserve the strongest interruption for the primary state transition.',
      groupingRule: 'Keep the trigger and resource acquisition quiet; join state and consequence as one conclusion.',
    },
    constraints: [
      'Preserve semantic order.',
      'Do not turn every step into an equal card.',
      'Use one dominant reading line.',
    ],
    prohibitedCopy: ['source wording', 'source artwork', 'source geometry', 'project branding'],
  }),
  PatternFragmentSchema.parse({
    schemaVersion: '0.1',
    fragmentId: 'pattern-break-threshold-field',
    sourceReferenceIds: ['ref-ppt-agent-functional', 'ref-reveal-runtime'],
    abstractionLevel: 'structural',
    compatibleIntents: ['mechanism', 'state-transition'],
    semanticShape: 'causal-chain',
    relationshipShape: ['enables', 'transitions-to', 'causes'],
    readingPath: 'center-out',
    densityBand: 'balanced',
    primaryArtifactRole: 'mechanism-flow',
    topology: {
      family: 'threshold-field',
      orderedRoles: ['trigger', 'input', 'process', 'primary', 'modifier'],
      emphasisRule: 'Treat the state transition as a threshold that reorganizes the page.',
      groupingRule: 'Place causes before the threshold and the damage modifier inside the resulting state field.',
    },
    constraints: [
      'Preserve semantic order even when the visual focus is central.',
      'The threshold must not hide the five-second condition.',
      'Avoid node-box diagrams.',
    ],
    prohibitedCopy: ['reference slide text', 'reference artwork', 'reference geometry', 'project branding'],
  }),
];
