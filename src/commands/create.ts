import { existsSync } from "node:fs";
import { copyProfile, emptyProfile } from "../core/copy.js";
import { CliError, info, success } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { hasConfig, profileDir, resolveProfile, validateProfileName } from "../core/profile.js";

export interface CreateOptions extends PathOptions {
  from?: string;
  empty?: boolean;
  force?: boolean;
}

export async function createCommand(name: string, options: CreateOptions): Promise<void> {
  validateProfileName(name);
  const paths = resolvePaths(options);

  if (options.empty) {
    await emptyProfile(paths, name, options.force);
    success(`Создан пустой профиль "${name}": ${profileDir(paths, name)}`);
    info(`Запуск: ocpm run ${name}`);
    return;
  }

  const sourceName = options.from ?? "default";
  const source = await resolveProfile(paths, sourceName);
  if (!hasConfig(source.dir)) {
    throw new CliError(`В источнике "${sourceName}" нет opencode.json или opencode.jsonc`);
  }
  if (existsSync(profileDir(paths, name)) && !options.force) {
    throw new CliError(`Профиль "${name}" уже существует; используйте --force`);
  }
  await copyProfile(paths, name, {
    sourceName,
    sourceDir: source.dir,
    force: options.force,
  });
  success(`Создан профиль "${name}" из "${sourceName}": ${profileDir(paths, name)}`);
  info(`Запуск: ocpm run ${name}`);
}
