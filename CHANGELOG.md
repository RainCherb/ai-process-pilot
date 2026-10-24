# Changelog

Все заметные изменения AI Process Pilot фиксируются здесь.

## 1.1.0 — 2026-10-24

### Added
- пакетная обработка до 50 обращений через `POST /api/tickets/batch`;
- append-only `audit_events` для создания обращений, batch/demo и смены статусов;
- `GET /api/audit` и read-only MCP tool `get_audit_events`;
- UI для пакетной обработки и просмотра последних audit-событий;
- размеченный regression dataset и `processpilot-eval`;
- quality gate классификатора в GitHub Actions;
- настоящий in-memory MCP 2.x client/server round-trip test;
- Docker HEALTHCHECK и container smoke job;
- Dependabot для pip и GitHub Actions.

### Changed
- Docker Compose запускается с read-only root filesystem, tmpfs и `no-new-privileges`;
- CI проверяет Python 3.11–3.13, Ruff, frontend JavaScript, pytest, evaluation, wheel и Docker image;
- архитектура и business-case документация обновлены под операционный сценарий.

## 1.0.3 — 2026-10-24

- миграция на MCP Python SDK 2.x / `MCPServer`;
- исправлен ROI rounding;
- усилена валидация LLM response и endpoint path;
- маскирование email расширено на IDN/Unicode domains.

## 1.0.2 — 2026-10-24

- явная обработка неоднозначной классификации;
- исправлены ложные legal/security keyword matches;
- усилены Unicode и LLM usage validations;
- добавлены regression/fuzz checks.

## 1.0.1 — 2026-10-24

- исправлена утечка SQLite connections;
- добавлены Host/Origin guards и security headers;
- атомарный demo seed;
- улучшены LLM URL validation и frontend edge cases.
