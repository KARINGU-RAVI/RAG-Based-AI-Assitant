import json
import logging
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.logs import SystemLog

# Set up basic Python logger
logger = logging.getLogger("RAG_Assistant")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(ch)

class SystemLogger:
    @staticmethod
    async def log(
        db: AsyncSession,
        level: str,
        module: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ) -> SystemLog:
        """Asynchronously writes a log entry both to standard output and the system_logs table."""
        level = level.upper()
        details_str = json.dumps(details) if details else None
        
        # Log locally using python logging
        log_msg = f"[{module}] {message}"
        if details:
            log_msg += f" | Details: {details_str}"
            
        if level == "INFO":
            logger.info(log_msg)
        elif level == "WARNING":
            logger.warning(log_msg)
        elif level == "ERROR":
            logger.error(log_msg)
        elif level == "CRITICAL":
            logger.critical(log_msg)
            
        # Log to Database
        db_log = SystemLog(
            level=level,
            module=module,
            message=message,
            details_json=details_str
        )
        
        db.add(db_log)
        await db.commit()
        return db_log

    @staticmethod
    async def info(db: AsyncSession, module: str, message: str, details: Optional[Dict[str, Any]] = None) -> SystemLog:
        return await SystemLogger.log(db, "INFO", module, message, details)

    @staticmethod
    async def warning(db: AsyncSession, module: str, message: str, details: Optional[Dict[str, Any]] = None) -> SystemLog:
        return await SystemLogger.log(db, "WARNING", module, message, details)

    @staticmethod
    async def error(db: AsyncSession, module: str, message: str, details: Optional[Dict[str, Any]] = None) -> SystemLog:
        return await SystemLogger.log(db, "ERROR", module, message, details)

    @staticmethod
    async def critical(db: AsyncSession, module: str, message: str, details: Optional[Dict[str, Any]] = None) -> SystemLog:
        return await SystemLogger.log(db, "CRITICAL", module, message, details)
