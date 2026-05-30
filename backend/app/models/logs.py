from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class SystemLog(Base):
    __tablename__ = "system_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False)  # 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    module: Mapped[str] = mapped_column(String(100), nullable=False)  # module name e.g., 'auth', 'rag', 'vectorstore'
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details_json: Mapped[str] = mapped_column(Text, nullable=True)  # Detailed JSON payload as string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
