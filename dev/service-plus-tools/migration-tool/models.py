"""Small data shapes shared between db.py and app.py. See DESIGN.md §6."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ClientDb:
    id: int
    name: str
    db_name: str


@dataclass(frozen=True)
class SchemaTarget:
    client: ClientDb
    schema_name: str

    @property
    def label(self) -> str:
        return f"{self.client.name} — {self.schema_name} ({self.client.db_name})"


@dataclass(frozen=True)
class MigrationResult:
    target: SchemaTarget
    success: bool
    error_message: str | None
    duration_seconds: float
