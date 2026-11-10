# ocpm — OpenCode Config Profiles Manager

[Русская версия](README.ru.md)

OpenCode profiles as separate configuration directories. Each profile is a full copy
of `~/.config/opencode` with its own `opencode.json`, `cli.json`, `agents/`, `commands/`,
`plugins/`, `skills/` and `AGENTS.md`.

`default` is the existing global OpenCode directory. `ocpm` does not modify it.

## Why

In OpenCode V2, one background service serves one config. If you just set
`OPENCODE_CONFIG_DIR`, the running service keeps using the old config.
`ocpm` puts its own `service.json` into each profile:

```json
{ "disabled": true }
```

OpenCode sees `disabled` and starts a private server for the profile. The global
`service.json` and the shared service remain untouched.

## Installation

```bash
npm install -g opencode-config-profiles-manager
```

After that the `ocpm` command is available.

From source:

```bash
npm install
npm run build
npm link
```

## Quick start

```bash
ocpm init
ocpm create unity --from default
ocpm list
ocpm run unity
```

Check:

```bash
ocpm doctor
ocpm doctor unity --fix
```

## Commands

| Command | Purpose |
|---|---|
| `ocpm init` | Create the profiles directory |
| `ocpm create <name> [--from default\|<profile>] [--empty] [--force]` | Create a profile as a full copy |
| `ocpm list` | List profiles, source and status |
| `ocpm run <name> [args...]` | Run OpenCode with a profile |
| `ocpm exec <name> -- <cmd...>` | Run a command with the profile environment |
| `ocpm shell <name>` | Shell with the profile environment |
| `ocpm env <name> [--shell sh\|fish\|powershell]` | Print export commands |
| `ocpm path <name>` | Path to the profile |
| `ocpm which` | Current profile |
| `ocpm remove <name> [--force]` | Remove a profile |
| `ocpm doctor [name] [--fix]` | Check configs and `service.json` |

### Examples

```bash
ocpm run unity
ocpm run unity -- --model provider/model
ocpm run unity -- run "почини тесты"

ocpm exec unity -- opencode plugin add @scope/plugin
ocpm exec unity -- opencode debug config

eval "$(ocpm env unity)"
opencode
```

`ocpm run` passes everything after the profile name to OpenCode. `ocpm exec` requires `--`
before the command.

## Where profiles live

By default:

```text
~/.config/opencode/profiles/<name>
```

That is, inside the global OpenCode directory. Profiles can be committed to git.

`default` is `~/.config/opencode` itself.

Overriding paths:

```bash
OCPM_BASE_DIR=/path/to/opencode-config
OCPM_PROFILES_DIR=/path/to/profiles
OCPM_OPENCODE_BIN=/path/to/opencode
```

Or with flags before the subcommand:

```bash
ocpm --base-dir /path/to/config --profiles-dir /path/to/profiles list
```

## What gets copied

On `ocpm create`, everything is copied except:

- `.git/`, `.log/`, `.opencode/` (board state);
- `profiles/` (to avoid recursion);
- `service.json` (`{"disabled":true}` is written to the profile);
- `.env`, `.env.*`, `.credentials*`;
- `.npmrc`, `.netrc`, `.git-credentials`, `.pypirc`, `auth.json`;
- `node_modules/`, `sessions/`, `storages/`, `logs/`, `cache/`, `tmp/`;
- `*.log`, `.DS_Store`, `Thumbs.db`, `chrome-devtools-profile/`.

Copying is atomic: the profile is assembled in a temporary directory and renamed
only after success.

The copied `.gitignore` ignores `service.json`, so it will not end up in git;
`ocpm run` will create it again.

## Service and data

- A profile has its own `service.json` with `disabled: true` → private server.
- The global `~/.config/opencode/service.json` is not read and not modified.
- Auth and sessions are shared: `~/.local/share/opencode/auth.json`, `opencode.db`.
- If the profile already has a `service.json` without `disabled`, `ocpm run` will add
  `--standalone` and warn.
- If `ocpm run` is launched from inside `~/.config/opencode`, `OPENCODE_DISABLE_PROJECT_CONFIG=1`
  is set so that the global `opencode.json` is not also picked up as a project config
  and does not override the profile.
- `ocpm env` executed from inside the configuration directory leaves
  `OPENCODE_DISABLE_PROJECT_CONFIG=1` in the current shell. If you then move to a
  project with its own `opencode.json`, run `unset OPENCODE_DISABLE_PROJECT_CONFIG`
  or `eval "$(ocpm env default)"`.

## Limitations

- Profiles are independent copies. Changes in `default` do not propagate to them automatically.
- `service.json` in a profile disables remote access and the password. If you need remote —
  configure it separately in the profile.
- `profiles/` is not synchronized with the database; to update, create the profile again
  or copy the needed files manually.
- `ocpm` does not manage git and does not commit profiles.

## Windows

- Paths are determined via `opencode debug paths`, with a fallback to `~/.config/opencode`.
- Launch goes through `cross-spawn`, so `opencode.cmd` is found.
- `ocpm shell` uses `%COMSPEC%` or `$SHELL`.
- `ocpm env` supports PowerShell.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

The tests use temporary directories and a fake `opencode`; the real config is not
modified.
