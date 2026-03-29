from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    decrypt_transport_password,
    get_password_hash,
    get_password_transport_public_key_pem,
    is_transport_encryption_payload,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordPublicKeyResponse,
    RegisterRequest,
    SessionResponse,
    UserProfileOut,
    UserProfileUpdateRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_MAX_LOGIN_ATTEMPTS = 5
_LOGIN_WINDOW = timedelta(minutes=10)
_LOGIN_LOCKOUT = timedelta(minutes=15)
_login_attempt_states: dict[str, dict] = {}
_login_attempt_lock = Lock()


def _login_attempt_key(request: Request, username: str) -> str:
    client_ip = request.client.host if request.client else "unknown"
    normalized_user = (username or "").strip().lower()
    return f"{client_ip}:{normalized_user}"


def _assert_login_allowed(key: str) -> None:
    now = datetime.now(timezone.utc)
    with _login_attempt_lock:
        state = _login_attempt_states.get(key)
        if not state:
            return

        lock_until = state.get("lock_until")
        if isinstance(lock_until, datetime):
            if lock_until > now:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="登录尝试过于频繁，请稍后再试",
                )
            _login_attempt_states.pop(key, None)


def _record_login_failure(key: str) -> None:
    now = datetime.now(timezone.utc)
    with _login_attempt_lock:
        state = _login_attempt_states.get(key)
        if not state:
            _login_attempt_states[key] = {"count": 1, "window_start": now, "lock_until": None}
            return

        window_start = state.get("window_start")
        if not isinstance(window_start, datetime) or now - window_start > _LOGIN_WINDOW:
            _login_attempt_states[key] = {"count": 1, "window_start": now, "lock_until": None}
            return

        state["count"] = int(state.get("count") or 0) + 1
        if state["count"] >= _MAX_LOGIN_ATTEMPTS:
            state["lock_until"] = now + _LOGIN_LOCKOUT


def _clear_login_failure_state(key: str) -> None:
    with _login_attempt_lock:
        _login_attempt_states.pop(key, None)


def _build_cookie_options(*, httponly: bool, max_age_seconds: int) -> dict:
    samesite = str(settings.session_cookie_samesite or "lax").strip().lower()
    if samesite not in {"lax", "strict", "none"}:
        samesite = "lax"

    options = {
        "httponly": httponly,
        "secure": settings.session_cookie_secure,
        "samesite": samesite,
        "path": "/",
        "max_age": max_age_seconds,
    }
    if settings.session_cookie_domain and settings.session_cookie_domain.strip():
        options["domain"] = settings.session_cookie_domain.strip()
    return options


def _set_session_cookie(response: Response, user: User, token: str) -> None:
    cookie_name = (
        settings.admin_session_cookie_name
        if user.role == "admin"
        else settings.user_session_cookie_name
    )
    response.set_cookie(
        cookie_name,
        token,
        **_build_cookie_options(
            httponly=True,
            max_age_seconds=settings.access_token_expire_minutes * 60,
        ),
    )


def _set_csrf_cookie(response: Response) -> None:
    csrf_token = token_urlsafe(32)
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        **_build_cookie_options(
            httponly=False,
            max_age_seconds=settings.csrf_cookie_ttl_minutes * 60,
        ),
    )


def _clear_session_cookie(response: Response, cookie_name: str) -> None:
    delete_kwargs = {"path": "/"}
    if settings.session_cookie_domain and settings.session_cookie_domain.strip():
        delete_kwargs["domain"] = settings.session_cookie_domain.strip()
    response.delete_cookie(cookie_name, **delete_kwargs)


def _clear_all_session_cookies(response: Response) -> None:
    _clear_session_cookie(response, settings.user_session_cookie_name)
    _clear_session_cookie(response, settings.admin_session_cookie_name)
    _clear_session_cookie(response, settings.csrf_cookie_name)


def _normalize_password_length(plain_password: str) -> str:
    normalized = str(plain_password or "")
    if len(normalized) < 6 or len(normalized) > 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password length must be between 6 and 128",
        )
    return normalized


def _resolve_transport_password(raw_password: str) -> str:
    payload = str(raw_password or "")
    is_encrypted = is_transport_encryption_payload(payload)

    if settings.password_transport_encryption_enabled and not is_encrypted:
        if not settings.password_transport_allow_plaintext_fallback:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password transport encryption is required",
            )
        return payload

    if is_encrypted:
        try:
            return decrypt_transport_password(payload)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return payload


@router.get("/password-public-key", response_model=PasswordPublicKeyResponse)
def password_public_key() -> PasswordPublicKeyResponse:
    if not settings.password_transport_encryption_enabled:
        return PasswordPublicKeyResponse(enabled=False, public_key=None)

    public_key_pem = get_password_transport_public_key_pem()
    if not public_key_pem:
        if settings.password_transport_allow_plaintext_fallback:
            return PasswordPublicKeyResponse(enabled=False, public_key=None)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password transport public key is unavailable",
        )

    return PasswordPublicKeyResponse(enabled=True, public_key=public_key_pem)


@router.post("/register", response_model=SessionResponse)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username exists")

    plain_password = _normalize_password_length(_resolve_transport_password(payload.password))

    user = User(
        username=payload.username,
        password_hash=get_password_hash(plain_password),
        role="user",
    )
    db.add(user)
    db.commit()

    token = create_access_token(user.username, user.role)
    _clear_all_session_cookies(response)
    _set_session_cookie(response, user, token)
    _set_csrf_cookie(response)
    return SessionResponse(username=user.username, role=user.role)


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    attempt_key = _login_attempt_key(request, payload.username)
    _assert_login_allowed(attempt_key)

    try:
        plain_password = _normalize_password_length(_resolve_transport_password(payload.password))
    except HTTPException:
        _record_login_failure(attempt_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(plain_password, user.password_hash):
        _record_login_failure(attempt_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _clear_login_failure_state(attempt_key)
    token = create_access_token(user.username, user.role)
    _clear_all_session_cookies(response)
    _set_session_cookie(response, user, token)
    _set_csrf_cookie(response)
    return SessionResponse(username=user.username, role=user.role)


@router.post("/logout")
def logout(
    response: Response,
    _csrf_ok: None = Depends(csrf_protect),
    _user: User = Depends(get_current_user),
):
    _clear_all_session_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserProfileOut)
def me(response: Response, request: Request, user: User = Depends(get_current_user)):
    if not (request.cookies.get(settings.csrf_cookie_name) or "").strip():
        _set_csrf_cookie(response)
    return UserProfileOut(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )


@router.put("/me", response_model=UserProfileOut)
def update_me(
    payload: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    _csrf_ok: None = Depends(csrf_protect),
    user: User = Depends(get_current_user),
):
    if payload.username and payload.username != user.username:
        exists = db.query(User).filter(User.username == payload.username).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username exists")
        user.username = payload.username

    if payload.password:
        plain_password = _normalize_password_length(_resolve_transport_password(payload.password))
        user.password_hash = get_password_hash(plain_password)

    db.commit()
    db.refresh(user)

    return UserProfileOut(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )
