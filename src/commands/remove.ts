import { success } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { removeProfile } from "../core/profile.js";

export interface RemoveOptions extends PathOptions {
  force?: boolean;
}

export async function removeCommand(name: string, options: RemoveOptions): Promise<void> {
  const paths = resolvePaths(options);
  await removeProfile(paths, name, options.force ?? false);
  success(`Профиль "${name}" удалён`);
}
