import { describe, expect, it } from 'vitest';
import {
  applyInformationDesignMode,
  resolveInformationDesignMode,
  validateInformationPlanForMode,
} from '../src/index.js';
import {
  interpretAuthoredFeatureComparison,
  parseAuthoredComparison,
} from '../../source-ingestion/src/index.js';

const authoredContent = '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n개선 보상 구조:\n- 보상 상자 2개\n메시지: 목표에 맞는 보상을 선택한다';

describe('Information Design mode boundary', () => {
  it('resolves distinct deterministic policies for document and presentation', () => {
    const document = resolveInformationDesignMode('document');
    const presentation = resolveInformationDesignMode('presentation');
    expect(document.policyId).toBe('document-information-design-v1');
    expect(document.sourceDetailPolicy).toBe('preserve-all-authored-detail');
    expect(presentation.policyId).toBe('presentation-information-design-v1');
    expect(presentation.messagePlacement).toBe('lead');
    expect(document).not.toEqual(presentation);
  });

  it('accepts the existing source-complete plan in both modes', () => {
    const { slide, informationPlan } = interpretAuthoredFeatureComparison(parseAuthoredComparison(authoredContent));
    expect(validateInformationPlanForMode({ slide, informationPlan, resolution: resolveInformationDesignMode('document') })).toEqual([]);
    expect(validateInformationPlanForMode({ slide, informationPlan, resolution: resolveInformationDesignMode('presentation') })).toEqual([]);
  });

  it('rejects a presentation plan that leaves the authored message until the end', () => {
    const { slide, informationPlan } = interpretAuthoredFeatureComparison(parseAuthoredComparison(authoredContent));
    const messageBlockId = informationPlan.readingOrder[1]!;
    const lateMessage = {
      ...informationPlan,
      readingOrder: [...informationPlan.readingOrder.filter((id) => id !== messageBlockId), messageBlockId],
    };
    const issues = validateInformationPlanForMode({
      slide,
      informationPlan: lateMessage,
      resolution: resolveInformationDesignMode('presentation'),
    });
    expect(issues.map((issue) => issue.path)).toContain('mode.presentation.messagePlacement');
    const resolved = applyInformationDesignMode({
      slide,
      informationPlan: lateMessage,
      resolution: resolveInformationDesignMode('presentation'),
    });
    expect(resolved.readingOrder.slice(0, 2)).toEqual([informationPlan.primaryArtifactBlockId, messageBlockId]);
    expect(new Set(resolved.readingOrder)).toEqual(new Set(informationPlan.readingOrder));
    expect(resolved.relationIds).toEqual(informationPlan.relationIds);
    expect(validateInformationPlanForMode({
      slide,
      informationPlan: resolved,
      resolution: resolveInformationDesignMode('presentation'),
    })).toEqual([]);
  });
});
