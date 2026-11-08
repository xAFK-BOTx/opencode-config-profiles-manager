import { existsSync } from "node:fs";
import { info, table, warn } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { currentProfile, hasConfig, listProfiles, type Profile } from "../core/profile.js";
import { readService } from "../core/service.js";

async function statusOf(profile: Profile): Promise<string> {
  if (!hasConfig(profile.dir)) return "no-config";
  if (profile.isDefault) return "ok";
  const service = await readService(profile.dir);
  if (!service) return "service?";
  return service.disabled === true ? "ok" : "service";
}

export async function listCommand(options: PathOptions): Promise<void> {
  const paths = resolvePaths(options);
  const current = currentProfile(paths);
  const profiles = await listProfiles(paths);
  const rows: string[][] = [];
  for (const profile of profiles) {
    rows.push([
      `${profile.name === current ? "*" : " "} ${profile.name}`,
      profile.isDefault ? "global" : (profile.manifest?.source ?? "?"),
      await statusOf(profile),
      profile.dir,
    ]);
  }
  info(table([["NAME", "SOURCE", "STATUS", "PATH"], ...rows]));
  if (!existsSync(paths.profilesDir)) info("Профилей нет. Запустите ocpm init.");
  if (current.startsWith("custom:")) warn(`Текущий OPENCODE_CONFIG_DIR вне профилей: ${current.slice(7)}`);
}
