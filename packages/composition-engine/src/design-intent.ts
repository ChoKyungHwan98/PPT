import type { CompositionPlan, PatternFragment } from '@game-presentation/contracts';

/**
 * PatternFragment의 추상 디자인 판단을 Renderer가 실행할 수 있는 값으로 구체화한다.
 * Renderer는 reference나 fragment ID를 다시 해석하지 않고 이 계약만 소비한다.
 */
export function styleIntentForPattern(fragment: PatternFragment): CompositionPlan['styleIntent'] {
  if (fragment.topology.family === 'threshold-field') {
    return {
      tone: 'focused temporal mechanism stage',
      contrastModel: 'high-contrast-stage',
      hierarchy: {
        primaryTextSize: 78,
        supportTextSize: 30,
        evidenceTextSize: 44,
        primaryWeight: 800,
        supportWeight: 600,
      },
      accent: {
        targetRole: 'primary-artifact',
        color: '#B43E32',
        softColor: '#F3D7D1',
      },
      motif: {
        family: 'threshold-plane',
        color: '#D75043',
        strokeWidth: 8,
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
        primaryTextSize: 70,
        supportTextSize: 32,
        evidenceTextSize: 42,
        primaryWeight: 800,
        supportWeight: 500,
      },
      accent: {
        targetRole: 'primary-artifact',
        color: '#2F6964',
        softColor: '#DCE9E4',
      },
      motif: {
        family: 'causal-spine',
        color: '#3F7772',
        strokeWidth: 5,
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
