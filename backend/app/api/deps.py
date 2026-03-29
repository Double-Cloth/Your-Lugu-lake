from secrets import compare_digest

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)


def _extract_token_candidates(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> list[str]:
    candidates: list[str] = []

    bearer_token = (credentials.credentials if credentials else "") or ""
    if bearer_token.strip():
        candidates.append(bearer_token.strip())

    user_cookie_token = (request.cookies.get(settings.user_session_cookie_name) or "").strip()
    if user_cookie_token:
        candidates.append(user_cookie_token)

    admin_cookie_token = (request.cookies.get(settings.admin_session_cookie_name) or "").strip()
    if admin_cookie_token:
        candidates.append(admin_cookie_token)

    return candidates


def csrf_protect(request: Request) -> None:
    if not settings.enforce_csrf:
        return

    if request.method.upper() in {"GET", "HEAD", "OPTIONS"}:
        return

    # CSRF protection is required for cookie-backed auth. Pure bearer-token clients are exempt.
    has_cookie_session = bool(
        (request.cookies.get(settings.user_session_cookie_name) or "").strip()
        or (request.cookies.get(settings.admin_session_cookie_name) or "").strip()
    )
    if not has_cookie_session:
        return

    cookie_token = (request.cookies.get(settings.csrf_cookie_name) or "").strip()
    header_name = str(settings.csrf_header_name or "x-csrf-token").strip().lower()
    header_token = (request.headers.get(header_name) or "").strip()

    if not cookie_token or not header_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing")

    if not compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token invalid")


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = None
    for token in _extract_token_candidates(request, credentials):
        try:
            payload = decode_token(token)
            break
        except ValueError:
            continue

    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user
