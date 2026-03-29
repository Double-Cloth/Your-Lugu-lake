import base64
from functools import lru_cache

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey

from app.core.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
PASSWORD_CIPHER_PREFIX = "enc:rsa_oaep_sha256:"


def _normalize_pem(raw_value: str) -> str:
    return (raw_value or "").replace("\\n", "\n").strip()


@lru_cache(maxsize=1)
def get_password_transport_private_key() -> RSAPrivateKey | None:
    pem = _normalize_pem(settings.password_transport_private_key_pem)
    if not pem:
        return None

    key = serialization.load_pem_private_key(pem.encode("utf-8"), password=None)
    if not isinstance(key, RSAPrivateKey):
        raise ValueError("PASSWORD_TRANSPORT_PRIVATE_KEY_PEM must be an RSA private key")
    return key


@lru_cache(maxsize=1)
def get_password_transport_public_key_pem() -> str:
    pem = _normalize_pem(settings.password_transport_public_key_pem)
    if pem:
        return pem

    private_key = get_password_transport_private_key()
    if not private_key:
        return ""

    public_key = private_key.public_key()
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")


def is_transport_encryption_payload(value: str) -> bool:
    return str(value or "").strip().startswith(PASSWORD_CIPHER_PREFIX)


def decrypt_transport_password(value: str) -> str:
    payload = str(value or "").strip()
    if not payload:
        return ""
    if not is_transport_encryption_payload(payload):
        return payload

    private_key = get_password_transport_private_key()
    if not private_key:
        raise ValueError("Password transport private key is not configured")

    ciphertext_b64 = payload[len(PASSWORD_CIPHER_PREFIX):].strip()
    if not ciphertext_b64:
        raise ValueError("Encrypted password payload is empty")

    try:
        ciphertext = base64.b64decode(ciphertext_b64)
    except Exception as exc:  # pragma: no cover - malformed transport payload
        raise ValueError("Encrypted password payload is invalid") from exc

    try:
        plaintext_bytes = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
    except Exception as exc:  # pragma: no cover - decryption failure path
        raise ValueError("Encrypted password cannot be decrypted") from exc

    try:
        return plaintext_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Decrypted password is not valid UTF-8") from exc


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
