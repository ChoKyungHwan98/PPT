import { describe, expect, it } from 'vitest';
import { PresentationPlanSchema } from '@game-presentation/contracts';
import { renderPresentationHtml } from '../src/index.js';

describe('renderPresentationHtml', () => {
  it('renders semantic pages without raster slide images', () => {
    const plan = PresentationPlanSchema.parse({ schemaVersion:'0.1', planId:'plan-1', documentId:'doc-1', sourceHash:'a'.repeat(64), projectTitle:'도로시아', sectionTitle:'밸런스', slideProfile:'screen-16:9', author:'deterministic-planner', slides:[{ id:'goal', role:'goal-definition', title:'목표를 고정했다', message:'기준을 먼저 정한다.', layoutFamily:'editorial-goal-columns', sourceBlockIds:['t-1'], goals:[{axis:'속도감',target:'1.35초',evidence:'초반 TTK',sourceBlockIds:['t-1']},{axis:'성장감',target:'×134',evidence:'성장',sourceBlockIds:['t-1']}]}] });
    const html = renderPresentationHtml(plan);
    expect(html).toContain('목표를 고정했다');
    expect(html).toContain('data-slide-id="goal"');
    expect(html).not.toContain('<img');
  });
});
