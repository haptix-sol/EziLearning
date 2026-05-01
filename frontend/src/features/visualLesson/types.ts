export type VisualSlideKind =
  | 'intro'
  | 'objectives'
  | 'concept'
  | 'step'
  | 'code'
  | 'summary'
  | 'recap'
  | 'checkpoint'
  | 'practice';

export interface VisualAnimationStep {
  id: string;
  reveal_ids?: string[];
  highlight_ids?: string[];
  dim_ids?: string[];
}

export interface VisualLessonSlide {
  id: string;
  kind: VisualSlideKind | string;
  title: string;
  short_explanation?: string;
  diagram_type: string;
  diagram_data: Record<string, unknown>;
  code_example?: { language: string; code: string; highlight_lines?: number[] } | null;
  highlight_targets?: string[];
  animation_sequence?: { steps: VisualAnimationStep[] };
  narration_text?: string;
  audio_url?: string | null;
  caption_keywords?: string[];
  checkpoint_question?: string | null;
  checkpoint_options?: string[] | null;
  checkpoint_answer_index?: number | null;
  summary_points?: string[] | null;
  quiz?: { question: string; options: string[]; answer_index: number } | null;
}

export interface VisualLessonManifest {
  lesson_title: string;
  lesson_objective: string;
  lesson_type: string;
  topic_key: string;
  day_context?: string;
  slides: VisualLessonSlide[];
}
