from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import quote_plus


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Lugu Lake Guide API"
    database_url: str = ""
    db_host: str = "db"
    db_port: int = 5432
    postgres_db: str = "lugu_lake"
    postgres_user: str = "lugu"
    postgres_password: str = "lugu123"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    dashscope_api_key: str = ""
    dashscope_model: str = "qwen-plus"
    upload_dir: str = "uploads"
    cors_origins: str = "*"

    @property
    def resolved_database_url(self) -> str:
        # In deployment, empty env values should not override valid defaults.
        if self.database_url and self.database_url.strip():
            return self.database_url.strip()

        host = self.db_host.strip() if self.db_host else "db"
        port = self.db_port or 5432
        if host in {"db", "postgres", "postgresql"}:
            # Service-to-service traffic in compose network always uses container port.
            port = 5432
        db_name = self.postgres_db.strip() if self.postgres_db else "lugu_lake"
        user = quote_plus(self.postgres_user.strip() if self.postgres_user else "lugu")
        password = quote_plus(self.postgres_password.strip() if self.postgres_password else "")

        if password:
            return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{db_name}"
        return f"postgresql+psycopg://{user}@{host}:{port}/{db_name}"


settings = Settings()
