export type BrokenLine = {
  text: string;
  width: number;
};

const FORBIDDEN_LINE_START = /^[,.:;!?%)}\]〉》」』】…·]/u;
const FORBIDDEN_LINE_END = /[(<{\[〈《「『【]$/u;

function graphemes(text: string, locale: string): string[] {
  return [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)].map(
    (part) => part.segment,
  );
}

function words(text: string, locale: string): string[] {
  return [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)].map(
    (part) => part.segment,
  );
}

export function breakKoreanLines(input: {
  text: string;
  maxWidth: number;
  measure: (text: string) => number;
  locale?: string;
}): BrokenLine[] {
  const locale = input.locale ?? 'ko-KR';
  const lines: BrokenLine[] = [];
  let current = '';

  const commit = (): void => {
    const text = current.trimEnd();
    if (text.length > 0) lines.push({ text, width: input.measure(text) });
    current = '';
  };

  const appendGraphemeByGrapheme = (token: string): void => {
    for (const grapheme of graphemes(token, locale)) {
      const candidate = current + grapheme;
      if (current.length > 0 && input.measure(candidate) > input.maxWidth) {
        if (FORBIDDEN_LINE_START.test(grapheme) || FORBIDDEN_LINE_END.test(current)) {
          current = candidate;
        } else {
          commit();
          current = grapheme;
        }
      } else {
        current = candidate;
      }
    }
  };

  for (const token of words(input.text, locale)) {
    if (token.includes('\n')) {
      const parts = token.split('\n');
      parts.forEach((part, index) => {
        if (part.length > 0) appendGraphemeByGrapheme(part);
        if (index < parts.length - 1) commit();
      });
      continue;
    }
    const candidate = current.length === 0 ? token.trimStart() : current + token;
    if (candidate.length === 0) continue;
    if (input.measure(candidate) <= input.maxWidth) {
      current = candidate;
      continue;
    }
    if (current.trim().length > 0 && !FORBIDDEN_LINE_START.test(token.trimStart())) {
      commit();
    }
    appendGraphemeByGrapheme(token.trimStart());
  }
  commit();
  return lines;
}
