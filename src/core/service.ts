import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ServiceInfo {
  disabled?: boolean;
  password?: string;
  remote?: unknown;
  [key: string]: unknown;
}

export interface EnsureResult {
  ok: boolean;
  created: boolean;
}

export function servicePath(dir: string): string {
  return join(dir, "service.json");
}

export function hasServiceFile(dir: string): boolean {
  return existsSync(servicePath(dir));
}

export async function readService(dir: string): Promise<ServiceInfo | undefined> {
  try {
    return JSON.parse(await readFile(servicePath(dir), "utf8")) as ServiceInfo;
  } catch {
    return undefined;
  }
}

export async function writeDisabledService(dir: string): Promise<void> {
  await writeFile(servicePath(dir), JSON.stringify({ disabled: true }, null, 2) + "\n", { mode: 0o600 });
}

export async function ensureServiceDisabled(dir: string): Promise<EnsureResult> {
  if (!hasServiceFile(dir)) {
    await writeDisabledService(dir);
    return { ok: true, created: true };
  }
  const service = await readService(dir);
  return { ok: service?.disabled === true, created: false };
}

export function hasSecret(service: ServiceInfo | undefined): boolean {
  return Boolean(service && (service.password || service.remote));
}

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SKIPPED_ENV = new Set(["XDG_STATE_HOME"]);

export function serviceEnv(service: ServiceInfo | undefined): Record<string, string> {
  const source = service?.env;
  if (source === null || typeof source !== "object" || Array.isArray(source)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string" || !ENV_KEY.test(key) || SKIPPED_ENV.has(key)) continue;
    result[key] = value;
  }
  return result;
}

export async function readServiceEnv(dir: string): Promise<Record<string, string>> {
  return serviceEnv(await readService(dir));
}

export function hasInvalidEnv(service: ServiceInfo | undefined): boolean {
  const source = service?.env;
  if (source === undefined) return false;
  if (source === null || typeof source !== "object" || Array.isArray(source)) return true;
  return Object.entries(source).some(([key, value]) => typeof value !== "string" || !ENV_KEY.test(key));
}
