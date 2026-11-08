import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse, type ParseError } from "jsonc-parser";
import { getOpencodeVersion } from "../core/opencode.js";
import { error, info, success, warn } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { hasConfig, listProfiles, resolveProfile, type Profile } from "../core/profile.js";
import {
  ensureServiceDisabled,
  hasSecret,
  hasServiceFile,
  readService,
  servicePath,
} from "../core/service.js";

export interface DoctorOptions extends PathOptions {
  fix?: boolean;
}

interface CheckResult {
  errors: number;
  warnings: number;
}

async function checkConfig(profile: Profile): Promise<CheckResult> {
  if (!existsSync(profile.dir)) {
    error(`${profile.name}: каталог не найден: ${profile.dir}`);
    return { errors: 1, warnings: 0 };
  }
  if (!hasConfig(profile.dir)) {
    error(`${profile.name}: нет opencode.json или opencode.jsonc`);
    return { errors: 1, warnings: 0 };
  }
  const file = join(profile.dir, existsSync(join(profile.dir, "opencode.json")) ? "opencode.json" : "opencode.jsonc");
  const errors: ParseError[] = [];
  parse(await readFile(file, "utf8"), errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    error(`${profile.name}: ошибка JSONC в ${file}`);
    return { errors: 1, warnings: 0 };
  }
  return { errors: 0, warnings: 0 };
}

async function findBrokenSymlinks(root: string, current = root): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        await stat(path);
      } catch {
        result.push(relative(root, path));
      }
      continue;
    }
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      result.push(...(await findBrokenSymlinks(root, path)));
    }
  }
  return result;
}

async function checkProfile(profile: Profile, fix: boolean): Promise<CheckResult> {
  const config = await checkConfig(profile);
  let errors = config.errors;
  let warnings = config.warnings;
  if (errors > 0) return { errors, warnings };

  if (!profile.isDefault) {
    if (!hasServiceFile(profile.dir)) {
      if (fix) {
        await ensureServiceDisabled(profile.dir);
        success(`${profile.name}: создан service.json с disabled: true`);
      } else {
        warn(`${profile.name}: нет service.json; ocpm run создаст его, или используйте --fix`);
        warnings++;
      }
    } else {
      const service = await readService(profile.dir);
      if (!service) {
        error(`${profile.name}: некорректный JSON в ${servicePath(profile.dir)}`);
        errors++;
      } else if (service.disabled !== true) {
        warn(`${profile.name}: service.json не disabled; профиль может использовать общий сервис`);
        warnings++;
      }
      if (hasSecret(service)) {
        warn(`${profile.name}: в service.json есть password/remote`);
        warnings++;
      }
    }
    if (!existsSync(join(profile.dir, ".ocpm.json"))) {
      warn(`${profile.name}: нет .ocpm.json`);
      warnings++;
    }
  }

  for (const link of await findBrokenSymlinks(profile.dir)) {
    warn(`${profile.name}: битая ссылка ${link}`);
    warnings++;
  }

  if (errors === 0 && warnings === 0) success(`${profile.name}: ok`);
  return { errors, warnings };
}

export async function doctorCommand(name: string | undefined, options: DoctorOptions): Promise<void> {
  const paths = resolvePaths(options);
  let errors = 0;
  let warnings = 0;

  const version = getOpencodeVersion(paths.bin);
  if (version) {
    info(`OpenCode: v${version}`);
    if (!version.startsWith("2.")) {
      warn(`Ожидается OpenCode V2, найдено ${version}`);
      warnings++;
    }
  } else {
    warn(`OpenCode не найден: ${paths.bin}`);
    warnings++;
  }

  info(`Config:   ${paths.configDir}`);
  info(`Profiles: ${paths.profilesDir}`);
  if (!existsSync(paths.profilesDir)) {
    warn(`Каталог профилей не найден: ${paths.profilesDir}; запустите ocpm init`);
    warnings++;
  }

  const profiles = name ? [await resolveProfile(paths, name)] : await listProfiles(paths);
  for (const profile of profiles) {
    const result = await checkProfile(profile, options.fix ?? false);
    errors += result.errors;
    warnings += result.warnings;
  }

  info(`Итого: ошибок ${errors}, предупреждений ${warnings}`);
  if (errors > 0) process.exitCode = 1;
}
