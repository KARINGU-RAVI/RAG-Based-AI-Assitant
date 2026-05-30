from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.system_logger import SystemLogger

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Registers a new user. The first registered user is automatically promoted to 'admin'."""
    # Check if username exists
    username_result = await db.execute(select(User).filter(User.username == user_in.username))
    if username_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered"
        )
        
    # Check if email exists
    email_result = await db.execute(select(User).filter(User.email == user_in.email))
    if email_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
        
    # Check if this is the first user in the system to make them admin
    total_users_result = await db.execute(select(User))
    first_user = total_users_result.scalars().first() is None
    role = "admin" if first_user else "user"
    
    # Hash password and create user
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=role,
        is_active=True
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    await SystemLogger.info(
        db, "auth", f"User registered successfully: {db_user.username} (Role: {db_user.role})"
    )
    
    return db_user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Logs in an active user, generating a secure JWT token. Supports login via username or email."""
    # Search by username
    result = await db.execute(select(User).filter(User.username == form_data.username))
    db_user = result.scalars().first()
    
    # Fallback to search by email
    if not db_user:
        result = await db.execute(select(User).filter(User.email == form_data.username))
        db_user = result.scalars().first()
        
    if not db_user or not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username/email or password"
        )
        
    if not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(subject=db_user.id, expires_delta=access_token_expires)
    
    await SystemLogger.info(db, "auth", f"User logged in successfully: {db_user.username}")
    
    return Token(
        access_token=token,
        role=db_user.role,
        username=db_user.username
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Retrieves profile details of the currently authenticated user session."""
    return current_user
