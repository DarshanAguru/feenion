from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Feenion Server"
    app_version: str = "0.1.2"

    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str = "sqlite:///./feenion.db"
    redis_url: str = "redis://localhost:6379/0"

    max_batch_size: int = 100
    max_payload_size: int = 10 * 1024 * 1024  # 10 MB

    log_level: str = "INFO"
    retention_days: int = 30
    sample_rate: float = 1.0

    model_config = SettingsConfigDict(
        env_prefix="FEENION_",
        env_file=".env",
        extra="ignore",
    )

settings = Settings()