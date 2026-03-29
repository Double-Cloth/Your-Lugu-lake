from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=4096)


class LoginRequest(BaseModel):
    username: str
    password: str


class SessionResponse(BaseModel):
    ok: bool = True
    username: str
    role: str


class PasswordPublicKeyResponse(BaseModel):
    enabled: bool
    algorithm: str = "RSA-OAEP-256"
    public_key: str | None = None


class UserProfileOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: str


class UserProfileUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    password: str | None = Field(default=None, min_length=6, max_length=4096)
