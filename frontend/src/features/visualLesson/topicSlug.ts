/** Must match backend `services.visual_lesson_catalog.topic_key`. */
export function topicSlug(topic: string): string {
  const t = topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (t.slice(0, 200) || 'topic');
}
