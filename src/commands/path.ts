import { resolvePaths, type PathOptions } from "../core/paths.js";
import { resolveProfile } from "../core/profile.js";

export async function pathCommand(name: string, options: PathOptions): Promise<void> {
  const paths = resolvePaths(options);
  const profile = await resolveProfile(paths, name);
  process.stdout.write(profile.dir + "\n");
}
