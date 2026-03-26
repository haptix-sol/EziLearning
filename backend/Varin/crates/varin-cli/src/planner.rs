use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SceneTemplate {
    IntroUnderline,
    HeadingDiagram,
    ConceptCards,
    FormulaFlow,
    SplitCompare,
    TimelineLadder,
    ArrayCompareSwap,
    TeacherExplainer,
    RecapOutro,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BriefInput {
    #[serde(default)]
    pub title: Option<String>,
    pub brief: String,
    pub target_minutes: Option<f32>,
    pub style: Option<String>,
    #[serde(default)]
    pub sections: Vec<String>,
    #[serde(default)]
    pub concept_density: Option<String>,
    #[serde(default)]
    pub animation_intensity: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PlannedScene {
    pub id: String,
    pub title: String,
    pub visual_instruction: String,
    pub narration: String,
    pub caption: String,
    pub duration_seconds: f32,
    pub template: SceneTemplate,
}

pub fn plan_from_brief(input: &BriefInput) -> Vec<PlannedScene> {
    let topic_title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("Topic")
        .to_string();
    let sections = normalized_sections(input);

    let words = input.brief.split_whitespace().count().max(8);
    let est_speech_sec = (words as f32 / 2.6).max(30.0);
    let target_total = (input.target_minutes.unwrap_or(5.0) * 60.0).clamp(30.0, 900.0);
    let effective_total = target_total.max(est_speech_sec * 1.45);

    let density_factor = match input.concept_density.as_deref().unwrap_or("medium") {
        "deep" => 1.25,
        "light" => 0.85,
        _ => 1.0,
    };
    let mut section_scene_multiplier = 1.0f32;
    if sections.len() >= 7 {
        section_scene_multiplier = 1.22;
    } else if sections.len() >= 5 {
        section_scene_multiplier = 1.12;
    }
    let intensity_factor = match input.animation_intensity.as_deref().unwrap_or("balanced") {
        "calm" => 0.94,
        "high" => 1.08,
        _ => 1.0,
    };

    let mut scene_count = ((sections.len() as f32 + 2.0) * section_scene_multiplier).round() as usize;
    scene_count = scene_count.max(4);
    let duration_based = ((effective_total / 42.0) * density_factor * intensity_factor).ceil() as usize;
    scene_count = scene_count.max(duration_based).clamp(4, 18);

    let scene_duration = (effective_total / scene_count as f32).clamp(20.0, 70.0);
    let style_prefix = match input.style.as_deref().unwrap_or("explanatory") {
        "fast" => "Fast-paced",
        "high_quality" => "High-detail",
        _ => "Explanatory",
    };

    (0..scene_count)
        .map(|idx| {
            let template = choose_template(idx, scene_count);
            let section_label = if idx == 0 {
                "Intro and goals".to_string()
            } else if idx + 1 == scene_count {
                "Recap and takeaway".to_string()
            } else {
                let section_idx = (idx - 1).min(sections.len().saturating_sub(1));
                sections[section_idx].clone()
            };
            let title = scene_title_for_template(&template, &section_label, idx + 1, scene_count);
            let narration = narration_for_scene(
                style_prefix,
                &topic_title,
                &section_label,
                &input.brief,
                idx + 1,
                scene_count,
                &template,
            );
            let visual_instruction = visual_instruction_for_scene(
                &topic_title,
                &section_label,
                idx + 1,
                scene_count,
                &template,
            );

            PlannedScene {
                id: format!("scene_{:02}", idx + 1),
                title: title.clone(),
                visual_instruction,
                narration,
                caption: title,
                duration_seconds: scene_duration,
                template,
            }
        })
        .collect()
}

fn normalized_sections(input: &BriefInput) -> Vec<String> {
    let from_input: Vec<String> = input
        .sections
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if !from_input.is_empty() {
        return from_input;
    }

    // Fallback from brief sentence chunks when explicit sections are absent.
    let mut derived: Vec<String> = input
        .brief
        .split(|c| ['.', ';', '\n'].contains(&c))
        .map(|s| s.trim())
        .filter(|s| s.split_whitespace().count() >= 3)
        .map(|s| {
            let mut out = s.to_string();
            if out.len() > 70 {
                out.truncate(70);
                out.push_str("...");
            }
            out
        })
        .take(6)
        .collect();
    if derived.is_empty() {
        derived.push("Core idea explained".to_string());
        derived.push("Guided visual walkthrough".to_string());
        derived.push("Practical takeaway".to_string());
    }
    derived
}

fn choose_template(idx: usize, total: usize) -> SceneTemplate {
    if idx == 0 {
        return SceneTemplate::IntroUnderline;
    }
    if idx + 1 == total {
        return SceneTemplate::RecapOutro;
    }

    // Avoid adjacent repetition by deterministic rotating pattern.
    let rotation = [
        SceneTemplate::HeadingDiagram,
        SceneTemplate::ConceptCards,
        SceneTemplate::FormulaFlow,
        SceneTemplate::SplitCompare,
        SceneTemplate::TimelineLadder,
        SceneTemplate::ArrayCompareSwap,
        SceneTemplate::HeadingDiagram,
    ];
    let pick = (idx - 1) % rotation.len();
    rotation[pick].clone()
}

fn scene_title_for_template(
    template: &SceneTemplate,
    section_label: &str,
    idx: usize,
    total: usize,
) -> String {
    match template {
        SceneTemplate::IntroUnderline => "Introduction".to_string(),
        SceneTemplate::HeadingDiagram => format!("{} - Visual Map", section_label),
        SceneTemplate::ConceptCards => format!("{} - Key Points", section_label),
        SceneTemplate::FormulaFlow => format!("{} - Step Flow", section_label),
        SceneTemplate::SplitCompare => format!("{} - Compare and Contrast", section_label),
        SceneTemplate::TimelineLadder => format!("{} - Layered Timeline", section_label),
        SceneTemplate::ArrayCompareSwap => format!("{} - Dynamic Walkthrough", section_label),
        SceneTemplate::TeacherExplainer => format!("{} - Guided Walkthrough", section_label),
        SceneTemplate::RecapOutro => {
            if total <= 4 {
                "Quick Recap".to_string()
            } else {
                format!("Recap and Next Steps ({idx}/{total})")
            }
        }
    }
}

fn narration_for_scene(
    style_prefix: &str,
    topic_title: &str,
    section_label: &str,
    brief: &str,
    idx: usize,
    total: usize,
    template: &SceneTemplate,
) -> String {
    if matches!(template, SceneTemplate::RecapOutro) {
        return format!(
            "{style_prefix} wrap-up for {topic_title}: summarize {section_label}, reinforce the key mental model, and close with one actionable practice step."
        );
    }
    if matches!(template, SceneTemplate::TeacherExplainer) {
        return format!(
            "{style_prefix} guided explanation for {topic_title}: use a teacher-avatar style visual to explain '{section_label}' step by step, pointing to the key idea and one practical example. Source brief: {brief}"
        );
    }
    if matches!(template, SceneTemplate::SplitCompare) {
        return format!(
            "{style_prefix} compare scene for {topic_title}: present '{section_label}' as two alternative approaches, highlight where each works best, and end with a clear decision rule. Source brief: {brief}"
        );
    }
    if matches!(template, SceneTemplate::TimelineLadder) {
        return format!(
            "{style_prefix} progression scene for {topic_title}: break '{section_label}' into an ordered timeline of small steps, then connect each step to one practical coding action. Source brief: {brief}"
        );
    }
    if matches!(template, SceneTemplate::ArrayCompareSwap) {
        return format!(
            "{style_prefix} dynamic scene for {topic_title}: explain '{section_label}' using compare-highlight-swap beats so each visual step matches spoken narration. Source brief: {brief}"
        );
    }
    if idx == 1 {
        return format!(
            "{style_prefix} opening for {topic_title}: define what will be learned, why it matters, and how this video will guide the learner."
        );
    }
    format!(
        "{style_prefix} scene {idx}/{total} on {topic_title}: focus on '{section_label}'. Use clean visual explanation, then connect it back to the full topic. Source brief: {brief}"
    )
}

fn visual_instruction_for_scene(
    topic_title: &str,
    section_label: &str,
    idx: usize,
    total: usize,
    template: &SceneTemplate,
) -> String {
    match template {
        SceneTemplate::IntroUnderline => format!(
            "Draw title-first intro for '{topic_title}', reveal roadmap nodes for '{section_label}', then close with a transition-ready recap line ({idx}/{total})."
        ),
        SceneTemplate::HeadingDiagram => format!(
            "Build a center heading map for '{section_label}' with two branch examples, arrows, and staged emphasis pulses."
        ),
        SceneTemplate::ConceptCards => format!(
            "Reveal three concept cards for '{section_label}' left-to-right, connect cards with arrows, then show a concise synthesis line."
        ),
        SceneTemplate::FormulaFlow => format!(
            "Animate step-flow sequence for '{section_label}' using replacement transitions and endpoint highlight."
        ),
        SceneTemplate::SplitCompare => format!(
            "Create side-by-side compare board for '{section_label}' with decision rule footer and synchronized card reveals."
        ),
        SceneTemplate::TimelineLadder => format!(
            "Render ladder/timeline progression for '{section_label}' with 4 ordered checkpoints and matching descriptive blocks."
        ),
        SceneTemplate::ArrayCompareSwap => format!(
            "Use compare-highlight-swap choreography for '{section_label}' with explicit pair highlighting, swap motion, and final state stabilization."
        ),
        SceneTemplate::TeacherExplainer => format!(
            "Character template disabled. Fall back to non-character diagram flow for '{section_label}'."
        ),
        SceneTemplate::RecapOutro => format!(
            "Build recap panel for '{topic_title}', show checklist-style closure for '{section_label}', and finish with takeaway emphasis."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn planner_expands_when_target_duration_large() {
        let plan = plan_from_brief(&BriefInput {
            title: None,
            brief: "Object oriented programming with classes inheritance polymorphism encapsulation abstraction".to_string(),
            target_minutes: Some(5.0),
            style: Some("explanatory".to_string()),
            sections: vec![],
            concept_density: None,
            animation_intensity: None,
        });
        assert!(plan.len() >= 6);
        let total: f32 = plan.iter().map(|s| s.duration_seconds).sum();
        assert!(total >= 290.0);
    }

    #[test]
    fn planner_has_clean_outro_template() {
        let plan = plan_from_brief(&BriefInput {
            title: None,
            brief: "simple interest explained".to_string(),
            target_minutes: Some(1.0),
            style: None,
            sections: vec![],
            concept_density: None,
            animation_intensity: None,
        });
        assert!(!plan.is_empty());
        assert!(matches!(
            plan.last().map(|s| &s.template),
            Some(SceneTemplate::RecapOutro)
        ));
    }

    #[test]
    fn planner_respects_explicit_sections() {
        let plan = plan_from_brief(&BriefInput {
            title: Some("Java OOP".to_string()),
            brief: "Classes, objects, and the four pillars.".to_string(),
            target_minutes: Some(3.0),
            style: Some("high_quality".to_string()),
            sections: vec![
                "Learning goals".to_string(),
                "Class vs object".to_string(),
                "Encapsulation".to_string(),
                "Inheritance and polymorphism".to_string(),
            ],
            concept_density: Some("deep".to_string()),
            animation_intensity: Some("balanced".to_string()),
        });
        assert!(plan.len() >= 5);
        assert!(plan.iter().any(|p| p.title.contains("Class vs object")));
        assert!(matches!(
            plan.last().map(|s| &s.template),
            Some(SceneTemplate::RecapOutro)
        ));
    }

    #[test]
    fn planner_keeps_non_character_templates_for_now() {
        let plan = plan_from_brief(&BriefInput {
            title: Some("Data Structures".to_string()),
            brief: "Arrays linked lists stacks queues trees graphs hashing and searching algorithms."
                .to_string(),
            target_minutes: Some(4.0),
            style: Some("high_quality".to_string()),
            sections: vec![
                "Intro".to_string(),
                "Array basics".to_string(),
                "Linked list intuition".to_string(),
                "Stack and queue".to_string(),
                "Tree traversal".to_string(),
                "Graph overview".to_string(),
            ],
            concept_density: Some("deep".to_string()),
            animation_intensity: Some("high".to_string()),
        });
        assert!(!plan
            .iter()
            .any(|p| matches!(p.template, SceneTemplate::TeacherExplainer)));
    }
}
