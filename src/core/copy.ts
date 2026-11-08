import { randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { isSubpath, samePath, type Paths } from "./paths.js";
import { profileDir, writeManifest, type Manifest } from "./profile.js";
import { writeDisabledService } from "./service.js";
import { CliError } from "./output.js";

const ANY_DEPTH = new Set([".git", "node_modules", ".DS_Store", "Thumbs.db"]);
const TOP_LEVEL = new Set([
  ".log",
  ".opencode",
  "service.json",
  ".ocpm.json",
  "profiles",
  "sessions",
  "storages",
  "logs",
  "cache",
  "tmp",
  "chrome-devtools-profile",
  ".npmrc",
  ".netrc",
  ".git-credentials",
  ".pypirc",
  "auth.json",
]);

function isEnvFile(name: string): boolean {
  return name === ".env" || name.startsWith(".env.") || name.startsWith(".credentials");
}

function shouldCopy(sourceRoot: string, profilesDir: string, src: string): boolean {
  const rel = relative(sourceRoot, src);
  if (rel === "") return true;
  const parts = rel.split(sep);
  const name = parts[parts.length - 1];
  if (ANY_DEPTH.has(name)) return false;
  if (name.endsWith(".log")) return false;
  if (isEnvFile(name)) return false;
  if (parts.length === 1 && (TOP_LEVEL.has(name) || name.startsWith(".tmp-") || name.startsWith(".bak-"))) {
    return false;
  }
  if (isSubpath(sourceRoot, profilesDir) && isSubpath(profilesDir, src)) return false;
  if (samePath(profilesDir, src)) return false;
  return true;
}

export interface CopyOptions {
  sourceName: string;
  sourceDir: string;
  opencodeVersion?: string;
  force?: boolean;
}

function randomSuffix(): string {
  return randomBytes(4).toString("hex");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function replaceTarget(target: string, temp: string, force: boolean): Promise<void> {
  if (!(await pathExists(target))) {
    await rename(temp, target);
    return;
  }
  if (!force) throw new CliError(`Профиль "${basename(target)}" уже существует; используйте --force`);
  const backup = join(dirname(target), `.bak-${basename(target)}-${randomSuffix()}`);
  await rename(target, backup);
  try {
    await rename(temp, target);
    await rm(backup, { recursive: true, force: true });
  } catch (cause) {
    await rename(backup, target).catch(() => undefined);
    throw cause;
  }
}

async function copyDir(
  root: string,
  current: string,
  profilesDir: string,
  dest: string,
): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(current, entry.name);
    if (!shouldCopy(root, profilesDir, src)) continue;
    const target = join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      let info;
      try {
        info = await stat(src);
      } catch {
        throw new CliError(`Битая ссылка: ${src}`);
      }
      if (info.isDirectory()) await copyDir(root, src, profilesDir, target);
      else if (info.isFile()) await copyFileWithMode(src, target, info.mode);
      continue;
    }
    if (entry.isDirectory()) {
      await copyDir(root, src, profilesDir, target);
    } else if (entry.isFile()) {
      await copyFileWithMode(src, target, (await stat(src)).mode);
    }
  }
}

async function copyFileWithMode(src: string, dest: string, mode: number): Promise<void> {
  await copyFile(src, dest);
  await chmod(dest, mode & 0o777).catch(() => undefined);
}

export async function copyProfile(paths: Paths, name: string, options: CopyOptions): Promise<Manifest> {
  const target = profileDir(paths, name);
  const temp = join(paths.profilesDir, `.tmp-${name}-${randomSuffix()}`);
  const sourceDir = resolve(options.sourceDir);
  const profilesDir = resolve(paths.profilesDir);
  await mkdir(paths.profilesDir, { recursive: true });
  try {
    await copyDir(sourceDir, sourceDir, profilesDir, temp);
    await writeDisabledService(temp);
    const manifest: Manifest = {
      version: 1,
      name,
      source: options.sourceName,
      sourcePath: resolve(options.sourceDir),
      createdAt: new Date().toISOString(),
      ...(options.opencodeVersion ? { opencodeVersion: options.opencodeVersion } : {}),
    };
    await writeManifest(temp, manifest);
    await replaceTarget(target, temp, options.force ?? false);
    return manifest;
  } catch (cause) {
    await rm(temp, { recursive: true, force: true });
    throw cause;
  }
}

export async function emptyProfile(
  paths: Paths,
  name: string,
  opencodeVersion?: string,
  force = false,
): Promise<Manifest> {
  const target = profileDir(paths, name);
  const temp = join(paths.profilesDir, `.tmp-${name}-${randomSuffix()}`);
  await mkdir(paths.profilesDir, { recursive: true });
  try {
    await mkdir(temp, { recursive: true });
    await writeFile(
      join(temp, "opencode.json"),
      JSON.stringify({ $schema: "https://opencode.ai/config.json" }, null, 2) + "\n",
      { mode: 0o644 },
    );
    await writeDisabledService(temp);
    const manifest: Manifest = {
      version: 1,
      name,
      source: "empty",
      sourcePath: "",
      createdAt: new Date().toISOString(),
      ...(opencodeVersion ? { opencodeVersion } : {}),
    };
    await writeManifest(temp, manifest);
    await replaceTarget(target, temp, force);
    return manifest;
  } catch (cause) {
    await rm(temp, { recursive: true, force: true });
    throw cause;
  }
}
