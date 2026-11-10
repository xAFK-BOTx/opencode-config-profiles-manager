# ocpm — OpenCode Config Profiles Manager

[English version](README.md)

Профили OpenCode как отдельные каталоги конфигурации. Каждый профиль — полная копия
`~/.config/opencode` со своими `opencode.json`, `cli.json`, `agents/`, `commands/`,
`plugins/`, `skills/` и `AGENTS.md`.

`default` — это существующий глобальный каталог OpenCode. `ocpm` его не изменяет.

## Зачем

В OpenCode V2 один фоновый сервис обслуживает один конфиг. Если просто подставить
`OPENCODE_CONFIG_DIR`, запущенный сервис продолжит использовать старый конфиг.
`ocpm` кладёт в каждый профиль свой `service.json`:

```json
{ "disabled": true }
```

OpenCode видит `disabled` и поднимает приватный сервер для профиля. Глобальный
`service.json` и общий сервис остаются нетронутыми.

## Установка

```bash
npm install -g opencode-config-profiles-manager
```

После этого доступна команда `ocpm`.

Из исходников:

```bash
npm install
npm run build
npm link
```

## Быстрый старт

```bash
ocpm init
ocpm create unity --from default
ocpm list
ocpm run unity
```

Проверка:

```bash
ocpm doctor
ocpm doctor unity --fix
```

## Команды

| Команда | Назначение |
|---|---|
| `ocpm init` | Создать каталог профилей |
| `ocpm create <name> [--from default\|<profile>] [--empty] [--force]` | Создать профиль полной копией |
| `ocpm list` | Список профилей, источника и статуса |
| `ocpm run <name> [args...]` | Запустить OpenCode с профилем |
| `ocpm exec <name> -- <cmd...>` | Выполнить команду с окружением профиля |
| `ocpm shell <name>` | Shell с окружением профиля |
| `ocpm env <name> [--shell sh\|fish\|powershell]` | Напечатать export-команды |
| `ocpm path <name>` | Путь к профилю |
| `ocpm which` | Текущий профиль |
| `ocpm remove <name> [--force]` | Удалить профиль |
| `ocpm doctor [name] [--fix]` | Проверить конфиги и `service.json` |

### Примеры

```bash
ocpm run unity
ocpm run unity -- --model provider/model
ocpm run unity -- run "почини тесты"

ocpm exec unity -- opencode plugin add @scope/plugin
ocpm exec unity -- opencode debug config

eval "$(ocpm env unity)"
opencode
```

`ocpm run` передаёт всё после имени профиля в OpenCode. `ocpm exec` требует `--`
перед командой.

## Где лежат профили

По умолчанию:

```text
~/.config/opencode/profiles/<name>
```

То есть внутри глобального каталога OpenCode. Профили можно коммитить в git.

`default` — сам `~/.config/opencode`.

Переопределение путей:

```bash
OCPM_BASE_DIR=/path/to/opencode-config
OCPM_PROFILES_DIR=/path/to/profiles
OCPM_OPENCODE_BIN=/path/to/opencode
```

Или флагами до подкоманды:

```bash
ocpm --base-dir /path/to/config --profiles-dir /path/to/profiles list
```

## Что копируется

При `ocpm create` копируется всё, кроме:

- `.git/`, `.log/`, `.opencode/` (состояние board);
- `profiles/` (чтобы не было рекурсии);
- `service.json` (в профиль пишется `{"disabled":true}`);
- `.env`, `.env.*`, `.credentials*`;
- `.npmrc`, `.netrc`, `.git-credentials`, `.pypirc`, `auth.json`;
- `node_modules/`, `sessions/`, `storages/`, `logs/`, `cache/`, `tmp/`;
- `*.log`, `.DS_Store`, `Thumbs.db`, `chrome-devtools-profile/`.

Копирование атомарное: профиль собирается во временном каталоге и переименовывается
только после успеха.

Скопированный `.gitignore` игнорирует `service.json`, поэтому в git он не попадёт;
`ocpm run` создаст его заново.

## Сервис и данные

- У профиля свой `service.json` с `disabled: true` → приватный сервер.
- Глобальный `~/.config/opencode/service.json` не читается и не изменяется.
- Auth и сессии общие: `~/.local/share/opencode/auth.json`, `opencode.db`.
- Если в профиле уже есть `service.json` без `disabled`, `ocpm run` добавит
  `--standalone` и предупредит.
- Если `ocpm run` запущен изнутри `~/.config/opencode`, ставится
  `OPENCODE_DISABLE_PROJECT_CONFIG=1`, чтобы глобальный `opencode.json` не
  подхватился ещё и как проектный и не перекрыл профиль.
- `ocpm env`, выполненный изнутри каталога конфигурации, оставляет
  `OPENCODE_DISABLE_PROJECT_CONFIG=1` в текущей оболочке. Если потом перейти в
  проект со своим `opencode.json`, выполните `unset OPENCODE_DISABLE_PROJECT_CONFIG`
  или `eval "$(ocpm env default)"`.

## Ограничения

- Профили — независимые копии. Изменения в `default` не попадают в них автоматически.
- `service.json` в профиле отключает remote-доступ и пароль. Если нужен remote —
  настройте его отдельно в профиле.
- `profiles/` не синхронизируется с базой; для обновления создайте профиль заново
  или скопируйте нужные файлы вручную.
- `ocpm` не управляет git и не коммитит профили.

## Windows

- Пути определяются через `opencode debug paths`, с fallback на `~/.config/opencode`.
- Запуск идёт через `cross-spawn`, поэтому находится `opencode.cmd`.
- `ocpm shell` использует `%COMSPEC%` или `$SHELL`.
- `ocpm env` поддерживает PowerShell.

## Разработка

```bash
npm install
npm run build
npm test
npm run typecheck
```

Тесты используют временные каталоги и фейковый `opencode`, реальный конфиг не
изменяется.
