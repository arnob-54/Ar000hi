"""Complaints model: business rules and persistence, independent of FastAPI."""
import uuid
from datetime import datetime, timezone
from app.models.database import db_session
from app.schemas.complaints import CreateComplaintRequest, UpdateComplaintRequest
from app.models.errors import DomainError


def create_complaint(body: CreateComplaintRequest, user_id: str):
    """File a new complaint.

    Improvement note:
    - This shared admin moderation API is now stricter about complaint content before it reaches the moderator queue.
    """
    if body.category not in ("safety", "misconduct", "vehicle", "payment", "other"):
        raise DomainError(status_code=400, detail="Invalid complaint category")

    if not body.subject.strip() or not body.description.strip():
        raise DomainError(status_code=400, detail="Subject and description are required")

    with db_session() as conn:
        if body.reported_id:
            reported = conn.execute("SELECT id FROM users WHERE id = ?", (body.reported_id,)).fetchone()
            if not reported:
                raise DomainError(status_code=404, detail="Reported user not found")

        complaint_id = str(uuid.uuid4())

        conn.execute(
            """INSERT INTO complaints (id, reporter_id, reported_id, category, subject, description)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (complaint_id, user_id, body.reported_id, body.category, body.subject.strip(), body.description.strip())
        )
        conn.commit()

        return {"message": "Complaint filed successfully", "complaint_id": complaint_id}


def get_complaints(user_id: str):
    """Get complaints — own complaints for users, all complaints for admin."""
    with db_session() as conn:
        user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()

        if user and user["role"] == "admin":
            # Admin sees all complaints
            complaints = conn.execute(
                """SELECT c.*, u.name as reporter_name, u.bracu_email as reporter_email
                   FROM complaints c
                   JOIN users u ON c.reporter_id = u.id
                   ORDER BY c.created_at DESC"""
            ).fetchall()
        else:
            # Users see only their own
            complaints = conn.execute(
                """SELECT c.*, u.name as reporter_name, u.bracu_email as reporter_email
                   FROM complaints c
                   JOIN users u ON c.reporter_id = u.id
                   WHERE c.reporter_id = ?
                   ORDER BY c.created_at DESC""",
                (user_id,)
            ).fetchall()


        return [
            {
                "id": c["id"],
                "reporter_name": c["reporter_name"],
                "reporter_email": c["reporter_email"],
                "category": c["category"],
                "subject": c["subject"],
                "description": c["description"],
                "status": c["status"],
                "admin_notes": c["admin_notes"],
                "created_at": c["created_at"],
                "resolved_at": c["resolved_at"],
            }
            for c in complaints
        ]


def update_complaint(complaint_id: str, body: UpdateComplaintRequest, admin_id: str):
    """Admin: Update complaint status and add notes."""
    if body.status not in ("open", "under_review", "resolved", "dismissed"):
        raise DomainError(status_code=400, detail="Invalid status")

    with db_session() as conn:
        complaint = conn.execute("SELECT id FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
        if not complaint:
            raise DomainError(status_code=404, detail="Complaint not found")

        resolved_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() if body.status in ("resolved", "dismissed") else None

        conn.execute(
            """UPDATE complaints SET status = ?, admin_notes = ?, resolved_by = ?, resolved_at = ?
               WHERE id = ?""",
            (body.status, body.admin_notes, admin_id, resolved_at, complaint_id)
        )
        conn.commit()

        return {"message": f"Complaint updated to '{body.status}'"}


def get_complaint_stats(admin_id: str):
    """Admin: Get complaint statistics."""
    with db_session() as conn:

        total = conn.execute("SELECT COUNT(*) as c FROM complaints").fetchone()["c"]
        open_count = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'open'").fetchone()["c"]
        review_count = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'under_review'").fetchone()["c"]
        resolved_count = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'resolved'").fetchone()["c"]
        dismissed_count = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'dismissed'").fetchone()["c"]


        return {
            "total": total,
            "open": open_count,
            "under_review": review_count,
            "resolved": resolved_count,
            "dismissed": dismissed_count,
        }
