import { z } from 'zod';
import { CandidateComparisonSchema } from '@game-presentation/contracts';

const ReviewCandidateSchema = z.strictObject({
  candidateId: z.string().min(1),
  imageDataUrl: z.string().startsWith('data:image/png;base64,'),
});

export const ReviewPageInputSchema = z.strictObject({
  title: z.string().min(1),
  sourceText: z.string().min(1),
  comparison: CandidateComparisonSchema,
  candidates: z.array(ReviewCandidateSchema).max(2),
});

export type ReviewPageInput = z.infer<typeof ReviewPageInputSchema>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function buildReviewHtml(rawInput: ReviewPageInput): string {
  const input = ReviewPageInputSchema.parse(rawInput);
  const comparison = input.comparison;
  if (comparison.mode !== 'pairwise') {
    throw new Error('현재 review proof는 두 후보가 모두 hard gate를 통과했을 때만 생성합니다.');
  }
  const imageById = new Map(input.candidates.map((candidate) => [candidate.candidateId, candidate.imageDataUrl]));
  const slots = (['A', 'B'] as const).map((slot) => {
    const candidate = comparison.slots[slot];
    const imageDataUrl = imageById.get(candidate.candidateId);
    if (imageDataUrl === undefined) throw new Error(slot + ' 후보의 PNG evidence가 없습니다.');
    return { slot, imageDataUrl };
  });
  const decisionBase = {
    comparisonId: comparison.comparisonId,
    contextHash: comparison.contextHash,
    context: comparison.context,
    candidateA: comparison.slots.A.signature,
    candidateB: comparison.slots.B.signature,
  };
  const cards = slots
    .map(
      ({ slot, imageDataUrl }) => `
        <figure class="candidate" data-slot="${slot}">
          <div class="slot-label">${slot}</div>
          <img src="${imageDataUrl}" alt="후보 ${slot}의 실제 렌더" />
        </figure>`,
    )
    .join('');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Pretendard, "Noto Sans KR", sans-serif; background: #e9e7e2; color: #242528; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 1180px; min-height: 100vh; background: #e9e7e2; }
    main { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; gap: 18px; padding: 22px 28px 20px; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
    h1 { margin: 0; font-size: 17px; font-weight: 750; letter-spacing: -0.02em; }
    .source { margin: 0; color: #666863; font-size: 13px; white-space: nowrap; }
    .stage { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: center; }
    .candidate { position: relative; margin: 0; min-width: 0; }
    .candidate img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #fff; box-shadow: 0 18px 44px rgba(44, 39, 31, 0.13); }
    .slot-label { position: absolute; z-index: 2; top: 12px; left: 12px; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: rgba(248,247,243,.94); color: #242528; font-size: 14px; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    footer { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; }
    .reason { width: 100%; border: 0; border-bottom: 1px solid #b9b7b1; background: transparent; padding: 10px 2px; font: inherit; font-size: 13px; outline: none; }
    .reason:focus { border-color: #555650; }
    .actions { display: flex; gap: 8px; }
    button { appearance: none; border: 1px solid #b9b7b1; background: #f5f3ee; color: #292a2c; padding: 10px 15px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    button:hover { background: #fff; border-color: #888981; }
    button[data-choice="reject-both"] { color: #9b3b32; }
    .status { position: fixed; inset: auto 24px 22px auto; padding: 10px 14px; border-radius: 8px; background: #262725; color: #fff; font-size: 12px; opacity: 0; transform: translateY(6px); transition: .18s ease; pointer-events: none; }
    .status.visible { opacity: 1; transform: translateY(0); }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(input.title)}</h1>
      <p class="source">${escapeHtml(input.sourceText)}</p>
    </header>
    <section class="stage" aria-label="후보 비교">${cards}</section>
    <footer>
      <input class="reason" id="reason" placeholder="선택 이유 (선택 사항)" aria-label="선택 이유" />
      <div class="actions" aria-label="선택">
        <button data-choice="A">A 선택</button>
        <button data-choice="B">B 선택</button>
        <button data-choice="tie">비슷함</button>
        <button data-choice="reject-both">둘 다 탈락</button>
      </div>
    </footer>
  </main>
  <div class="status" id="status" role="status">선택을 기록했습니다.</div>
  <script>
    const decisionBase = ${safeJson(decisionBase)};
    const reason = document.querySelector('#reason');
    const status = document.querySelector('#status');
    for (const button of document.querySelectorAll('button[data-choice]')) {
      button.addEventListener('click', () => {
        const now = new Date();
        const decision = { schemaVersion: '0.1', preferenceId: 'preference-' + decisionBase.comparisonId + '-' + now.getTime(), ...decisionBase, winner: button.dataset.choice, reasons: reason.value.trim() ? [reason.value.trim()] : [], createdAt: now.toISOString() };
        delete decision.comparisonId;
        localStorage.setItem('game-presentation-preference:' + decisionBase.comparisonId, JSON.stringify(decision));
        const blob = new Blob([JSON.stringify(decision, null, 2) + '\\n'], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = decisionBase.comparisonId + '.preference.json';
        link.click();
        URL.revokeObjectURL(link.href);
        status.classList.add('visible');
        setTimeout(() => status.classList.remove('visible'), 1600);
      });
    }
  </script>
</body>
</html>`;
}
