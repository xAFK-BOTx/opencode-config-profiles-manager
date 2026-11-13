import { buildProfileEnv, spawnInherit } from "../core/opencode.js";
import { CliError, warn } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { resolveProfile } from "../core/profile.js";
import { ensureServiceDisabled, readServiceEnv } from "../core/service.js";

export async function execCommand(name: string, command: string[], options: PathOptions): Promise<void> {
  const args = command[0] === "--" ? command.slice(1) : command;
  if (args.length === 0) throw new CliError("Укажите команду: ocpm exec <profile> -- <cmd...>");
  const paths = resolvePaths(options);
  const profile = await resolveProfile(paths, name);
  if (!profile.isDefault) {
    const service = await ensureServiceDisabled(profile.dir);
    if (!service.ok) warn(`В профиле "${name}" service.json не disabled`);
  }
  const [bin, ...rest] = args;
  const code = await spawnInherit({
    bin,
    args: rest,
    env: buildProfileEnv(profile, process.env, {
      configDir: paths.configDir,
      cwd: process.cwd(),
      serviceEnv: await readServiceEnv(profile.dir),
    }),
  });
  process.exitCode = code;
}
