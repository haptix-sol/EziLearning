/** Topic slugs — must match backend `core/challenge_topics.py` / API filter. */
export const TOPIC_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All topics' },
  { value: 'arrays', label: 'Arrays' },
  { value: 'linked-list', label: 'Linked list' },
  { value: 'strings', label: 'Strings' },
  { value: 'hash-table', label: 'Hash table' },
  { value: 'sorting', label: 'Sorting' },
  { value: 'trees', label: 'Trees' },
  { value: 'stacks-queues', label: 'Stacks & queues' },
  { value: 'binary-search', label: 'Binary search' },
  { value: 'graphs', label: 'Graphs' },
  { value: 'dynamic-programming', label: 'Dynamic programming' },
  { value: 'greedy', label: 'Greedy' },
  { value: 'two-pointers', label: 'Two pointers' },
  { value: 'sliding-window', label: 'Sliding window' },
  { value: 'bit-manipulation', label: 'Bit manipulation' },
  { value: 'math', label: 'Math' },
  { value: 'streams', label: 'Streams (Java / APIs)' },
  { value: 'general', label: 'General' },
];

const LABEL_MAP = Object.fromEntries(TOPIC_FILTERS.map((t) => [t.value, t.label]));

export function topicLabel(slug: string): string {
  return LABEL_MAP[slug] ?? slug;
}
