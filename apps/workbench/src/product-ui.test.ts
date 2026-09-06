import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('R7 product-facing information architecture', () => {
  it('starts from projects, exposes four product areas, and hides internal architecture terms', async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), 'StudioWorkbench.tsx'), 'utf8');
    for (const label of ['프로젝트', '기획서', '발표자료', 'AI 학습', '모델 관리', '후보 비교', 'AI 사용 내역', '변경 기록']) expect(source).toContain(label);
    for (const label of ['사람 평가', '학습 가능 여부', '검증 전', '이 모델 사용', '이전 모델로 되돌리기']) expect(source).toContain(label);
    for (const internal of ['SlideIR', 'InformationPlan', 'CompositionPlan', 'RenderTree', 'Harness', 'Teacher ID']) expect(source).not.toContain(internal);
    expect(source).toContain("useState<'projects' | 'project' | 'workspace'");
    expect(source).toContain("surface !== 'none'");
  });
});
