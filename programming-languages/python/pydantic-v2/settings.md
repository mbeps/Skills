# Pydantic Settings (`BaseSettings`)

`pydantic_settings.BaseSettings` extends `BaseModel` for environment-driven config.
This is a genuinely-used pattern in the `python-rag-service` project (not excel-mcp) —
`src/config/settings.py`. Reach for this file when a project loads config from env vars / `.env`.

## Import
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
```
Install: `pydantic-settings` (separate package from `pydantic`).

## Minimal form
```python
class Settings(BaseSettings):
    APP_NAME: str = "Agentic RAG Service"
    OPENAI_API_KEY: Optional[str] = None
```
Field names map to env vars case-insensitively by default (`OPENAI_API_KEY` ← `openai_api_key`).

## `SettingsConfigDict` (this project's real example)
```python
model_config = SettingsConfigDict(
    env_file=".env",        # read a .env file (path relative to cwd)
    env_file_encoding="utf-8",
    case_sensitive=False,   # case-insensitive env lookup (default)
    extra="ignore",         # ignore unknown env vars (avoid errors on stray vars)
    env_ignore_empty=True,  # empty env value treated as missing (falls back to default)
)
```

### Options used commonly
| Key                    | Effect                                        |
| ---------------------- | --------------------------------------------- |
| `env_file`             | path to `.env` file to load; `None` disables  |
| `env_file_encoding`    | default `'utf-8'`                             |
| `case_sensitive`       | default `False` (case-insensitive env lookup) |
| `extra`                | `'ignore'` (default)                          | `'forbid'` | `'allow'` |
| `env_ignore_empty`     | treat empty-string env vars as missing        |
| `env_prefix`           | prefix all env lookups (e.g. `APP_`)          |
| `env_nested_delimiter` | parse nested dicts from flat env keys         |

## Module singleton factory (common pattern)
```python
def get_settings() -> Settings:
    """Return the settings instance."""
    return Settings()

settings = get_settings()
```
Import the `settings` singleton elsewhere (`from src.config.settings import settings`) so config is
loaded once, not per request.

## Validating/normalizing a setting
Use `field_validator(..., mode="after")` on a `@classmethod` to sanitize values:
```python
from typing import Optional
from pydantic import field_validator

class Settings(BaseSettings):
    OPENAI_API_KEY: Optional[str] = None

    @field_validator("OPENAI_API_KEY", mode="after")
    @classmethod
    def _strip_api_key(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip().strip('"').strip("'")
        return value or None
```
`mode="after"` runs after default/env parsing; the value is already the parsed type.

## Gotchas
- `BaseSettings` reads env **before** validators; validation errors fail at import time — good for failing fast in CI.
- `env_ignore_empty=True` is important when CI sets empty secrets (e.g. `OPENAI_API_KEY=""`) — otherwise the empty string overrides the default.
- `extra="ignore"` is the default; use `extra="forbid"` only if you want to hard-fail on unknown env vars.
