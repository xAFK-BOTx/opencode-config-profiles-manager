import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import crossSpawn from "cross-spawn";

export interface Paths {
  bin: string;
  configDir: string;
  profilesDir: string;
}

export interface PathOptions {
  bin?: string;
  baseDir?: string;
  profilesDir?: string;
}

function fallbackConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "opencode") : join(homedir(), ".config", "opencode");
}

function parseDebugPaths(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(\S+)\s+(.+)$/);
    if (match) result.set(match[1], match[2]);
  }
  return result;
}

function debugConfigDir(bin: string): string | undefined {
  const env = { ...process.env };
  delete env.OPENCODE_CONFIG_DIR;
  delete env.OCPM_PROFILE;
  const result = crossSpawn.sync(bin, ["debug", "paths"], {
    encoding: "utf8",
    timeout: 10_000,
    env,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.status !== 0 || !result.stdout) return undefined;
  return parseDebugPaths(result.stdout).get("config");
}

export function resolvePaths(options: PathOptions = {}): Paths {
  const bin = options.bin ?? process.env.OCPM_OPENCODE_BIN ?? "opencode";
  const configDir = resolve(
    options.baseDir ?? process.env.OCPM_BASE_DIR ?? debugConfigDir(bin) ?? fallbackConfigDir(),
  );
  const profilesDir = resolve(
    options.profilesDir ?? process.env.OCPM_PROFILES_DIR ?? join(configDir, "profiles"),
  );
  return { bin, configDir, profilesDir };
}

export function normalizePath(value: string): string {
  const resolved = resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function samePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

export function isSubpath(parent: string, child: string): boolean {
  const rel = relative(normalizePath(parent), normalizePath(child));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}
