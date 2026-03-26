"""Database session management."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import settings
from models.base import Base
from models import (
    User,
    Resume,
    UserProfile,
    ResumeSkill,
    Challenge,
    UserChallenge,
    TechnicalQuestion,
    UserQuestionAnswer,
    Execution,
    ProgressSnapshot,
    UserSession,
    StudyPlan,
    StudyLevel,
    DayPlan,
    DayPlanCompletion,
    UserLevel,
    JobApplication,
    LevelCompletion,
    UserLevelContent,
    GmailOAuthToken,
    UserGoal,
    TrendingRole,
    RoadmapTopic,
    RoadmapTopicEdge,
    UserKnownTopic,
    DayMcq,
    UserMcqAnswer,
    GeneratedVideo,
    VarinRenderEvent,  # noqa: F401 — registered on Base for create_all
)


def get_engine():
    """Create database engine."""
    connect_args = {}
    if "sqlite" in settings.database_url:
        connect_args["check_same_thread"] = False
    pool_kw = {}
    if "postgresql" in settings.database_url:
        pool_kw = {"pool_size": 10, "max_overflow": 5, "pool_pre_ping": True}
    return create_engine(
        settings.database_url,
        connect_args=connect_args,
        echo=False,
        **pool_kw,
    )


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    _migrate_user_profile_columns()
    _migrate_day_plan_subtopics()
    _migrate_day_plan_challenge()
    _migrate_study_levels()
    _migrate_user_profile_avatar()
    _migrate_user_goal_plan()
    _migrate_job_columns()
    _migrate_video_file_path_nullable()
    _migrate_video_columns()
    _migrate_user_goal_study_plan_fk()
    _migrate_user_known_topic_goal_id()


def _migrate_user_profile_columns() -> None:
    """Add new UserProfile columns if missing (full_name, email, phone, education_summary, professional_summary)."""
    from sqlalchemy import text, inspect
    new_columns = [
        ("full_name", "VARCHAR(255)"),
        ("email", "VARCHAR(255)"),
        ("phone", "VARCHAR(50)"),
        ("education_summary", "TEXT"),
        ("professional_summary", "TEXT"),
    ]
    insp = inspect(engine)
    if "user_profiles" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("user_profiles")}
    with engine.connect() as conn:
        for col_name, col_type in new_columns:
            if col_name in existing:
                continue
            try:
                conn.execute(text(f"ALTER TABLE user_profiles ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()


def _migrate_day_plan_subtopics() -> None:
    """Add subtopics to day_plans if missing."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "day_plans" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("day_plans")}
    if "subtopics" in existing:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE day_plans ADD COLUMN subtopics JSON"))
            conn.commit()
    except Exception:
        pass


def _migrate_day_plan_challenge() -> None:
    """Add challenge_id to day_plans if missing."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "day_plans" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("day_plans")}
    if "challenge_id" in existing:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE day_plans ADD COLUMN challenge_id VARCHAR(36)"))
            conn.commit()
    except Exception:
        pass


def _migrate_study_levels() -> None:
    """Add level_id to day_plans if missing."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "day_plans" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("day_plans")}
    if "level_id" in existing:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE day_plans ADD COLUMN level_id VARCHAR(36)"))
            conn.commit()
    except Exception:
        pass


def _migrate_user_profile_avatar() -> None:
    """Add avatar_url to user_profiles if missing."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "user_profiles" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("user_profiles")}
    if "avatar_url" in existing:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE user_profiles ADD COLUMN avatar_url VARCHAR(512)"))
            conn.commit()
    except Exception:
        pass


def _migrate_user_goal_plan() -> None:
    """Add study_plan_id and duration_days to user_goals if missing."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "user_goals" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("user_goals")}
    for col_name, col_type in [("study_plan_id", "VARCHAR(36)"), ("duration_days", "INTEGER")]:
        if col_name in existing:
            continue
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE user_goals ADD COLUMN {col_name} {col_type}"))
                conn.commit()
        except Exception:
            pass


def _migrate_video_columns() -> None:
    """Add missing columns to generated_videos (caption_file_path, topic_slug)."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "generated_videos" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("generated_videos")}
    cols_to_add = [
        ("caption_file_path", "VARCHAR(512)"),
        ("topic_slug", "VARCHAR(255)"),
        ("status_message", "VARCHAR(256)"),
        ("segments_done", "INTEGER"),
        ("segments_total", "INTEGER"),
    ]
    for col_name, col_type in cols_to_add:
        if col_name in existing:
            continue
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE generated_videos ADD COLUMN {col_name} {col_type}"))
                conn.commit()
        except Exception:
            pass


def _migrate_video_file_path_nullable() -> None:
    """Allow file_path to be NULL on generated_videos (set when generation completes)."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "generated_videos" not in insp.get_table_names():
        return
    is_pg = "postgresql" in str(engine.url)
    if not is_pg:
        return  # SQLite: would need table recreate
    for col in insp.get_columns("generated_videos"):
        if col["name"] == "file_path" and col.get("nullable") is False:
            try:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE generated_videos ALTER COLUMN file_path DROP NOT NULL"))
                    conn.commit()
            except Exception:
                pass
            break


def _migrate_user_goal_study_plan_fk() -> None:
    """Add FK constraint on user_goals.study_plan_id -> study_plans.id ON DELETE CASCADE."""
    from sqlalchemy import text, inspect
    if "postgresql" not in str(engine.url):
        return
    insp = inspect(engine)
    if "user_goals" not in insp.get_table_names():
        return
    fks = insp.get_foreign_keys("user_goals")
    has_study_plan_fk = any(
        "study_plan_id" in (c.get("constrained_columns") or [])
        for c in fks
    )
    if has_study_plan_fk:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE user_goals ADD CONSTRAINT fk_user_goals_study_plan "
                "FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE"
            ))
            conn.commit()
    except Exception:
        pass


def _migrate_user_known_topic_goal_id() -> None:
    """Add goal_id to user_known_topics for per-goal roadmap."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "user_known_topics" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("user_known_topics")}
    if "goal_id" in existing:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE user_known_topics ADD COLUMN goal_id VARCHAR(36)"))
            conn.commit()
            if "postgresql" in str(engine.url):
                conn.execute(text(
                    "ALTER TABLE user_known_topics ADD CONSTRAINT fk_user_known_topic_goal "
                    "FOREIGN KEY (goal_id) REFERENCES user_goals(id) ON DELETE CASCADE"
                ))
                conn.commit()
    except Exception:
        pass


def _migrate_job_columns() -> None:
    """Add new columns to job_applications if missing."""
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "job_applications" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("job_applications")}
    is_pg = "postgresql" in str(engine.url)
    cols = [
        ("status_updates", "JSONB" if is_pg else "JSON"),
        ("last_synced_at", "TIMESTAMP WITH TIME ZONE" if is_pg else "DATETIME"),
        ("sector", "VARCHAR(20)"),
        ("notification_date", "TIMESTAMP WITH TIME ZONE" if is_pg else "DATETIME"),
        ("notification_type", "VARCHAR(50)"),
        ("company_details", "JSONB" if is_pg else "JSON"),
        ("government_portal", "VARCHAR(100)"),
        ("portal_credentials", "JSONB" if is_pg else "JSON"),
    ]
    for col_name, col_type in cols:
        if col_name in existing:
            continue
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE job_applications ADD COLUMN {col_name} {col_type}"))
                conn.commit()
        except Exception:
            pass


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
