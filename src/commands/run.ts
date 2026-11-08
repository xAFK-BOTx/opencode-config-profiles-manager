import { buildProfileEnv, buildRunArgs, spawnInherit } from "../core/opencode.js";
import { warn } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { resolveProfile } from "../core/profile.js";
import { ensureServiceDisabled } from "../core/service.js";

export async function runCommand(name: string, args: string[], options: PathOptions): Promise<void> {
  const paths = resolvePaths(options);
  const profile = await resolveProfile(paths, name);
  const opencodeArgs = args[0] === "--" ? args.slice(1) : args;
  let serviceOk = true;
  if (!profile.isDefault) {
    const service = await ensureServiceDisabled(profile.dir);
    serviceOk = service.ok;
    if (!service.ok) warn(`В профиле "${name}" service.json не disabled; использую --standalone`);
  }
  const code = await spawnInherit({
    bin: paths.bin,
    args: buildRunArgs(profile, opencodeArgs, serviceOk),
    env: buildProfileEnv(profile, process.env, { configDir: paths.configDir, cwd: process.cwd() }),
  });
  process.exitCode = code;
}
