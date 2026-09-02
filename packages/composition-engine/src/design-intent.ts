import type { CompositionPlan, PatternFragment } from '@game-presentation/contracts';

/**
 * PatternFragment의 추상 디자인 판단을 Renderer가 실행할 수 있는 값으로 구체화한다.
 * Renderer는 reference나 fragment ID를 다시 해석하지 않고 이 계약만 소비한다.
 */
export function styleIntentForPattern(fragment: PatternFragment): CompositionPlan['styleIntent'] {
  if (fragment.topology.family === 'aligned-before-after-spec') {
    return {
      tone: 'editorial feature specification',
      contrastModel: 'editorial-hierarchy',
      hierarchy: { primaryTextSize: 72, supportTextSize: 36, evidenceTextSize: 42, primaryWeight: 700, supportWeight: 400 },
      accent: { targetRole: 'evidence', color: '#254E44', softColor: '#E8EEE9' },
      motif: { family: 'editorial-rule', color: '#B9C8BF', strokeWidth: 1.5 },
      palette: { background: '#F8F7F3', ink: '#242E2A', mutedInk: '#626A64', connector: '#778D81' },
    };
  }
  if (fragment.topology.family === 'threshold-field') {
    return {
      tone: 'focused temporal mechanism stage',
      contrastModel: 'high-contrast-stage',
      hierarchy: {
        primaryTextSize: 58,
        supportTextSize: 34,
        evidenceTextSize: 46,
        primaryWeight: 800,
        supportWeight: 600,
      },
      accent: {
        targetRole: 'primary-artifact',
        color: '#B43E32',
        softColor: '#F8E6E1',
      },
      motif: {
        family: 'threshold-plane',
        color: '#D75043',
        strokeWidth: 5,
      },
      palette: {
        background: '#F6F3ED',
        ink: '#1E2726',
        mutedInk: '#58615F',
        connector: '#6F7B78',
      },
    };
  }

  if (fragment.topology.family === 'editorial-causal-spine') {
    return {
      tone: 'warm editorial game-design proof',
      contrastModel: 'editorial-hierarchy',
      hierarchy: {
        primaryTextSize: 56,
        supportTextSize: 34,
        evidenceTextSize: 46,
        primaryWeight: 800,
        supportWeight: 500,
      },
      accent: {
        targetRole: 'primary-artifact',
        color: '#2F6964',
        softColor: '#E2EEEA',
      },
      motif: {
        family: 'causal-spine',
        color: '#3F7772',
        strokeWidth: 4,
      },
      palette: {
        background: '#F7F4EE',
        ink: '#202624',
        mutedInk: '#69716E',
        connector: '#75817D',
      },
    };
  }

  return {
    tone: 'quiet information design field',
    contrastModel: 'quiet-field-strong-focus',
    hierarchy: {
      primaryTextSize: 68,
      supportTextSize: 30,
      evidenceTextSize: 40,
      primaryWeight: 800,
      supportWeight: 500,
    },
    accent: {
      targetRole: 'primary-artifact',
      color: '#5B5C8D',
      softColor: '#E3E2F0',
    },
    motif: {
      family: 'focus-field',
      color: '#6A6B9B',
      strokeWidth: 5,
    },
    palette: {
      background: '#F5F3EE',
      ink: '#222522',
      mutedInk: '#686C68',
      connector: '#777A76',
    },
  };
}
