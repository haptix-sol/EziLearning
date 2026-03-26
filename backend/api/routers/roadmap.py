"""Roadmap topics and known topics."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, get_db
from core.exceptions import NotFoundError
from models import RoadmapTopic, RoadmapTopicEdge, UserKnownTopic

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


@router.get("/topics")
def get_roadmap_topics(
    current_user: CurrentUser,
    goal_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Get full topic graph with user's known state. Optional goal_id for per-goal roadmap."""
    topics = db.query(RoadmapTopic).order_by(RoadmapTopic.order_index, RoadmapTopic.name).all()
    q = db.query(UserKnownTopic).filter(UserKnownTopic.user_id == current_user.id)
    if goal_id:
        q = q.filter(UserKnownTopic.goal_id == goal_id)
    else:
        q = q.filter(UserKnownTopic.goal_id.is_(None))
    known_ids = {k.topic_id for k in q.all()}
    edges = db.query(RoadmapTopicEdge).all()
    return {
        "topics": [
            {
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "description": t.description,
                "parent_id": t.parent_id,
                "order_index": t.order_index,
                "is_known": t.id in known_ids,
            }
            for t in topics
        ],
        "edges": [{"from": e.from_topic_id, "to": e.to_topic_id} for e in edges],
    }


@router.post("/topics/{topic_id}/known")
def mark_topic_known(
    topic_id: str,
    current_user: CurrentUser,
    goal_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Mark topic as known (excluded from study, kept in notes). Optional goal_id for per-goal roadmap."""
    topic = db.query(RoadmapTopic).filter(RoadmapTopic.id == topic_id).first()
    if not topic:
        raise NotFoundError("Topic not found")
    q = db.query(UserKnownTopic).filter(
        UserKnownTopic.user_id == current_user.id,
        UserKnownTopic.topic_id == topic_id,
    )
    if goal_id:
        q = q.filter(UserKnownTopic.goal_id == goal_id)
    else:
        q = q.filter(UserKnownTopic.goal_id.is_(None))
    existing = q.first()
    if existing:
        return {"message": "Already marked as known"}
    uk = UserKnownTopic(user_id=current_user.id, topic_id=topic_id, goal_id=goal_id)
    db.add(uk)
    db.commit()
    return {"message": "Marked as known"}


@router.delete("/topics/{topic_id}/known")
def unmark_topic_known(
    topic_id: str,
    current_user: CurrentUser,
    goal_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Unmark topic as known. Optional goal_id for per-goal roadmap."""
    q = db.query(UserKnownTopic).filter(
        UserKnownTopic.user_id == current_user.id,
        UserKnownTopic.topic_id == topic_id,
    )
    if goal_id:
        q = q.filter(UserKnownTopic.goal_id == goal_id)
    else:
        q = q.filter(UserKnownTopic.goal_id.is_(None))
    q.delete()
    db.commit()
    return {"message": "Unmarked"}
