import { existsSync } from "node:fs";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { isSubpath, samePath, type Paths } from "./paths.js";
import { CliError } from "./output.js";

export interface Manifest {
  version: 1;
  name: string;
  source: string;
}

export interface Profile {
  name: string;
  dir: string;
  isDefault: boolean;
  manifest?: Manifest;
}

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function validateProfileName(name: string): void {
  if (name === "default") throw new CliError('Имя "default" зарезервировано');
  if (!NAME_RE.test(name)) {
    throw new CliError("Имя профиля: строчные латинские буквы, цифры, _ и -, до 64 символов");
  }
  if (process.platform === "win32" && WINDOWS_RESERVED.test(name)) {
    throw new CliError(`Имя "${name}" зарезервировано Windows`);
  }
}

export function profileDir(paths: Paths, name: string): string {
  return join(paths.profilesDir, name);
}

export function manifestPath(dir: string): string {
  return join(dir, ".ocpm.json");
}

export async function readManifest(dir: string): Promise<Manifest | undefined> {
  try {
    return JSON.parse(await readFile(manifestPath(dir), "utf8")) as Manifest;
  } catch {
    return undefined;
  }
}

export async function writeManifest(dir: string, manifest: Manifest): Promise<void> {
  await writeFile(manifestPath(dir), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o644 });
}

export function hasConfig(dir: string): boolean {
  return existsSync(join(dir, "opencode.json")) || existsSync(join(dir, "opencode.jsonc"));
}

export async function resolveProfile(paths: Paths, name: string): Promise<Profile> {
  if (name === "default") return { name, dir: paths.configDir, isDefault: true };
  validateProfileName(name);
  const dir = profileDir(paths, name);
  if (!existsSync(dir)) throw new CliError(`Профиль "${name}" не найден`);
  return { name, dir, isDefault: false, manifest: await readManifest(dir) };
}

export async function listProfiles(paths: Paths): Promise<Profile[]> {
  const result: Profile[] = [{ name: "default", dir: paths.configDir, isDefault: true }];
  let entries: string[];
  try {
    entries = await readdir(paths.profilesDir);
  } catch {
    return result;
  }
  for (const name of entries.sort()) {
    if (name.startsWith(".")) continue;
    const dir = join(paths.profilesDir, name);
    try {
      if (!(await stat(dir)).isDirectory()) continue;
    } catch {
      continue;
    }
    result.push({ name, dir, isDefault: false, manifest: await readManifest(dir) });
  }
  return result;
}

export function currentProfile(paths: Paths): string {
  const explicit = process.env.OCPM_PROFILE;
  if (explicit) return explicit;
  const dir = process.env.OPENCODE_CONFIG_DIR;
  if (!dir) return "default";
  if (samePath(dir, paths.configDir)) return "default";
  if (isSubpath(paths.profilesDir, dir)) {
    const rel = relative(paths.profilesDir, dir);
    return rel.split(/[/\\]/)[0] || "default";
  }
  return `custom:${dir}`;
}

export async function removeProfile(paths: Paths, name: string, force: boolean): Promise<void> {
  if (name === "default") throw new CliError('Профиль "default" удалить нельзя');
  validateProfileName(name);
  const dir = profileDir(paths, name);
  if (!existsSync(dir)) throw new CliError(`Профиль "${name}" не найден`);
  if (currentProfile(paths) === name && !force) {
    throw new CliError(`Профиль "${name}" активен; используйте --force`);
  }
  await rm(dir, { recursive: true, force: true });
}
