import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { hasConfig } from "../core/profile.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { info, success, warn } from "../core/output.js";

export async function initCommand(options: PathOptions): Promise<void> {
  const paths = resolvePaths(options);
  await mkdir(paths.profilesDir, { recursive: true });
  info(`OpenCode config: ${paths.configDir}`);
  info(`Profiles:        ${paths.profilesDir}`);
  if (!existsSync(paths.configDir)) {
    warn(`Каталог конфигурации OpenCode не найден: ${paths.configDir}`);
  } else if (!hasConfig(paths.configDir)) {
    warn(`В каталоге нет opencode.json или opencode.jsonc: ${paths.configDir}`);
  }
  success("Готово. Создайте профиль: ocpm create <name> --from default");
}
