/** Normalize API / DB language string for comparisons and filters. */
export function normalizeChallengeLanguage(lang: string | null | undefined): string {
  if (!lang || !String(lang).trim()) return 'python';
  const k = String(lang).trim().toLowerCase();
  const aliases: Record<string, string> = {
    js: 'javascript',
    node: 'javascript',
    nodejs: 'javascript',
    'c++': 'cpp',
    cplusplus: 'cpp',
  };
  return aliases[k] ?? k;
}

/** Monaco editor ``language`` prop. */
export function monacoLanguageId(lang: string | null | undefined): string {
  const n = normalizeChallengeLanguage(lang);
  const map: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
  };
  return map[n] ?? 'plaintext';
}

export function challengeLanguageLabel(lang: string | null | undefined): string {
  const n = normalizeChallengeLanguage(lang);
  const labels: Record<string, string> = {
    python: 'Python',
    javascript: 'JavaScript',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
  };
  return labels[n] ?? n;
}

export const CHALLENGE_LANGUAGE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All languages' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
];
