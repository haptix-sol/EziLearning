"""SQLAlchemy models."""
from models.base import Base
from models.user import User
from models.resume import Resume, UserProfile, ResumeSkill
from models.content import Challenge, UserChallenge, TechnicalQuestion, UserQuestionAnswer
from models.execution import Execution
from models.progress import ProgressSnapshot, UserSession
from models.study import StudyPlan, StudyLevel, DayPlan, DayPlanCompletion, UserLevel, VisualLessonTopicProgress
from models.job import JobApplication
from models.game_level import LevelCompletion, UserLevelContent
from models.gmail import GmailOAuthToken
from models.onboarding import UserGoal, TrendingRole
from models.roadmap import RoadmapTopic, RoadmapTopicEdge, UserKnownTopic
from models.mcq import DayMcq, UserMcqAnswer
from models.cp_portfolio import CpPlatformConnection, CpPortfolioSettings

__all__ = [
    "Base",
    "User",
    "Resume",
    "UserProfile",
    "ResumeSkill",
    "Challenge",
    "UserChallenge",
    "TechnicalQuestion",
    "UserQuestionAnswer",
    "Execution",
    "ProgressSnapshot",
    "UserSession",
    "StudyPlan",
    "StudyLevel",
    "DayPlan",
    "DayPlanCompletion",
    "VisualLessonTopicProgress",
    "UserLevel",
    "JobApplication",
    "LevelCompletion",
    "UserLevelContent",
    "GmailOAuthToken",
    "UserGoal",
    "TrendingRole",
    "RoadmapTopic",
    "RoadmapTopicEdge",
    "UserKnownTopic",
    "DayMcq",
    "UserMcqAnswer",
    "CpPlatformConnection",
    "CpPortfolioSettings",
]
