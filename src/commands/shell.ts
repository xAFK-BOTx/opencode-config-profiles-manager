import { buildProfileEnv, spawnInherit } from "../core/opencode.js";
import { warn } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { resolveProfile } from "../core/profile.js";
import { ensureServiceDisabled, readServiceEnv } from "../core/service.js";

export async function shellCommand(name: string, options: PathOptions): Promise<void> {
  const paths = resolvePaths(options);
  const profile = await resolveProfile(paths, name);
  if (!profile.isDefault) {
    const service = await ensureServiceDisabled(profile.dir);
    if (!service.ok) warn(`В профиле "${name}" service.json не disabled`);
  }
  const shell =
    process.env.SHELL || process.env.COMSPEC || (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
  const code = await spawnInherit({
    bin: shell,
    args: [],
    env: buildProfileEnv(profile, process.env, {
      configDir: paths.configDir,
      cwd: process.cwd(),
      serviceEnv: await readServiceEnv(profile.dir),
    }),
  });
  process.exitCode = code;
}
