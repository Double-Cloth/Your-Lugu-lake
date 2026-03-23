from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Lugu Lake Guide API"
    database_url: str = "postgresql+psycopg://lugu:lugu123@localhost:5432/lugu_lake"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    dashscope_api_key: str = ""
    dashscope_model: str = "qwen-plus"
    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173"


settings = Settings()
