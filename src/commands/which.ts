import { resolvePaths, type PathOptions } from "../core/paths.js";
import { currentProfile } from "../core/profile.js";

export async function whichCommand(options: PathOptions): Promise<void> {
  const paths = resolvePaths(options);
  process.stdout.write(currentProfile(paths) + "\n");
}
