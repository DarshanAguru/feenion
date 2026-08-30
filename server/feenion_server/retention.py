from __future__ import annotations

import datetime
import threading
import time
from sqlalchemy.orm import Session
from .config import settings
from .db import SessionLocal, TraceModel, init_db

def purge_expired_traces(db: Session, retention_days: int = settings.retention_days) -> int:
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=retention_days)
    expired_query = db.query(TraceModel).filter(TraceModel.start_time < cutoff)
    count = expired_query.count()
    if count > 0:
        expired_query.delete(synchronize_session=False)
        db.commit()
    return count

class RetentionWorker:
    """
    Background worker that runs retention cleanup periodically based on FEENION_RETENTION_DAYS.
    """

    def __init__(self, retention_days: int = settings.retention_days, check_interval_hours: float = 24.0):
        self.retention_days = retention_days
        self.check_interval_seconds = check_interval_hours * 3600.0
        self._shutdown = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name="feenion-retention-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._shutdown.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    def _run(self) -> None:
        while not self._shutdown.is_set():
            db = SessionLocal()
            try:
                purged = purge_expired_traces(db, self.retention_days)
                if purged > 0:
                    print(f"[feenion-retention] Purged {purged} expired traces older than {self.retention_days} days.")
            except Exception as exc:
                db.rollback()
                print(f"[feenion-retention] Retention purge failed: {exc}")
            finally:
                db.close()

            self._shutdown.wait(timeout=self.check_interval_seconds)

retention_worker = RetentionWorker()

