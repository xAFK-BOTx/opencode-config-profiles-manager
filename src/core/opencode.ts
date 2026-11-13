import crossSpawn from "cross-spawn";
import type { Profile } from "./profile.js";
import { isSubpath, samePath } from "./paths.js";
import { CliError } from "./output.js";

export interface BuildEnvOptions {
  configDir?: string;
  cwd?: string;
  serviceEnv?: Record<string, string>;
}

export function isInsideConfigDir(configDir: string, cwd: string): boolean {
  return samePath(configDir, cwd) || isSubpath(configDir, cwd);
}

export function buildProfileEnv(
  profile: Profile,
  baseEnv: NodeJS.ProcessEnv = process.env,
  options: BuildEnvOptions = {},
): NodeJS.ProcessEnv {
  const env = { ...baseEnv };
  if (profile.isDefault) {
    delete env.OPENCODE_CONFIG_DIR;
    delete env.OCPM_PROFILE;
    if (env.OCPM_DISABLE_PROJECT_CONFIG === "1") {
      delete env.OPENCODE_DISABLE_PROJECT_CONFIG;
      delete env.OCPM_DISABLE_PROJECT_CONFIG;
    }
    return withServiceEnv(env, options.serviceEnv);
  }
  env.OPENCODE_CONFIG_DIR = profile.dir;
  env.OCPM_PROFILE = profile.name;
  delete env.OPENCODE_CONFIG;
  delete env.OPENCODE_CONFIG_CONTENT;
  const inside =
    options.configDir !== undefined &&
    options.cwd !== undefined &&
    isInsideConfigDir(options.configDir, options.cwd);
  if (env.OCPM_DISABLE_PROJECT_CONFIG === "1" && !inside) {
    delete env.OPENCODE_DISABLE_PROJECT_CONFIG;
    delete env.OCPM_DISABLE_PROJECT_CONFIG;
  }
  if (inside && env.OPENCODE_DISABLE_PROJECT_CONFIG === undefined) {
    env.OPENCODE_DISABLE_PROJECT_CONFIG = "1";
    env.OCPM_DISABLE_PROJECT_CONFIG = "1";
  }
  return withServiceEnv(env, options.serviceEnv);
}

function withServiceEnv(
  env: NodeJS.ProcessEnv,
  serviceEnv: Record<string, string> | undefined,
): NodeJS.ProcessEnv {
  return serviceEnv === undefined ? env : Object.assign(env, serviceEnv);
}

export function buildRunArgs(profile: Profile, args: string[], serviceOk: boolean): string[] {
  if (profile.isDefault || serviceOk) return args;
  const command = args[0];
  if (command === "serve" || command === "plugin") return args;
  return ["--standalone", ...args];
}

export interface SpawnOptions {
  bin: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd?: string;
}

export function spawnInherit(options: SpawnOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = crossSpawn(options.bin, options.args, {
      stdio: "inherit",
      env: options.env,
      cwd: options.cwd ?? process.cwd(),
    });
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
    const handlers = signals.map((signal) => {
      const handler = () => {
        if (!child.killed) child.kill(signal);
      };
      process.on(signal, handler);
      return [signal, handler] as const;
    });
    const cleanup = () => {
      for (const [signal, handler] of handlers) process.off(signal, handler);
    };
    child.on("error", (cause) => {
      cleanup();
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new CliError(`Не найден OpenCode: ${options.bin}`));
        return;
      }
      reject(cause);
    });
    child.on("exit", (code, signal) => {
      cleanup();
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export function getOpencodeVersion(bin: string): string | undefined {
  const result = crossSpawn.sync(bin, ["--version"], {
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.status !== 0 || !result.stdout) return undefined;
  const match = result.stdout.trim().match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match?.[1];
}
