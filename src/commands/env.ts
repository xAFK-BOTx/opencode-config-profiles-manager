import { basename } from "node:path";
import { isInsideConfigDir } from "../core/opencode.js";
import { CliError, warn } from "../core/output.js";
import { resolvePaths, type PathOptions } from "../core/paths.js";
import { resolveProfile } from "../core/profile.js";
import { ensureServiceDisabled, readServiceEnv } from "../core/service.js";

type Shell = "sh" | "fish" | "powershell";

export interface EnvOptions extends PathOptions {
  shell?: string;
}

function detectShell(explicit?: string): Shell {
  if (explicit) {
    const value = explicit.toLowerCase();
    if (value === "sh" || value === "bash" || value === "zsh") return "sh";
    if (value === "fish") return "fish";
    if (value === "powershell" || value === "pwsh" || value === "ps") return "powershell";
    throw new CliError(`Неизвестный shell: ${explicit}`);
  }
  if (process.platform === "win32") return "powershell";
  const shell = basename(process.env.SHELL ?? "");
  return shell.includes("fish") ? "fish" : "sh";
}

function quoteSh(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function quoteFish(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function exportLine(shell: Shell, key: string, value: string): string {
  if (shell === "sh") return `export ${key}=${quoteSh(value)}`;
  if (shell === "fish") return `set -gx ${key} ${quoteFish(value)}`;
  return `$env:${key} = ${quotePowerShell(value)}`;
}

export async function envCommand(name: string, options: EnvOptions): Promise<void> {
  const paths = resolvePaths(options);
  const profile = await resolveProfile(paths, name);
  const shell = detectShell(options.shell);
  if (!profile.isDefault) {
    const service = await ensureServiceDisabled(profile.dir);
    if (!service.ok) warn(`В профиле "${name}" service.json не disabled; выполните ocpm doctor --fix ${name}`);
  }
  const lines: string[] = [];
  const inside = !profile.isDefault && isInsideConfigDir(paths.configDir, process.cwd());
  const hadDisableProject = process.env.OCPM_DISABLE_PROJECT_CONFIG === "1";
  const disableProject =
    inside && (process.env.OPENCODE_DISABLE_PROJECT_CONFIG === undefined || hadDisableProject);
  const clearDisable = !inside && hadDisableProject;
  if (profile.isDefault) {
    if (shell === "sh") {
      lines.push("unset OCPM_PROFILE OPENCODE_CONFIG_DIR");
      if (clearDisable) lines.push("unset OPENCODE_DISABLE_PROJECT_CONFIG OCPM_DISABLE_PROJECT_CONFIG");
    } else if (shell === "fish") {
      lines.push("set -e OCPM_PROFILE", "set -e OPENCODE_CONFIG_DIR");
      if (clearDisable) lines.push("set -e OPENCODE_DISABLE_PROJECT_CONFIG", "set -e OCPM_DISABLE_PROJECT_CONFIG");
    } else {
      lines.push(
        "Remove-Item Env:OCPM_PROFILE -ErrorAction SilentlyContinue",
        "Remove-Item Env:OPENCODE_CONFIG_DIR -ErrorAction SilentlyContinue",
      );
      if (clearDisable) {
        lines.push(
          "Remove-Item Env:OPENCODE_DISABLE_PROJECT_CONFIG -ErrorAction SilentlyContinue",
          "Remove-Item Env:OCPM_DISABLE_PROJECT_CONFIG -ErrorAction SilentlyContinue",
        );
      }
    }
  } else if (shell === "sh") {
    if (clearDisable) {
      lines.push("unset OPENCODE_DISABLE_PROJECT_CONFIG OCPM_DISABLE_PROJECT_CONFIG");
    }
    lines.push("unset OPENCODE_CONFIG OPENCODE_CONFIG_CONTENT");
    lines.push(`export OCPM_PROFILE=${quoteSh(profile.name)}`);
    lines.push(`export OPENCODE_CONFIG_DIR=${quoteSh(profile.dir)}`);
    if (disableProject) lines.push("export OPENCODE_DISABLE_PROJECT_CONFIG=1", "export OCPM_DISABLE_PROJECT_CONFIG=1");
  } else if (shell === "fish") {
    if (clearDisable) {
      lines.push("set -e OPENCODE_DISABLE_PROJECT_CONFIG", "set -e OCPM_DISABLE_PROJECT_CONFIG");
    }
    lines.push("set -e OPENCODE_CONFIG", "set -e OPENCODE_CONFIG_CONTENT");
    lines.push(`set -gx OCPM_PROFILE ${quoteFish(profile.name)}`);
    lines.push(`set -gx OPENCODE_CONFIG_DIR ${quoteFish(profile.dir)}`);
    if (disableProject) {
      lines.push("set -gx OPENCODE_DISABLE_PROJECT_CONFIG 1", "set -gx OCPM_DISABLE_PROJECT_CONFIG 1");
    }
  } else {
    if (clearDisable) {
      lines.push(
        "Remove-Item Env:OPENCODE_DISABLE_PROJECT_CONFIG -ErrorAction SilentlyContinue",
        "Remove-Item Env:OCPM_DISABLE_PROJECT_CONFIG -ErrorAction SilentlyContinue",
      );
    }
    lines.push(
      "Remove-Item Env:OPENCODE_CONFIG -ErrorAction SilentlyContinue",
      "Remove-Item Env:OPENCODE_CONFIG_CONTENT -ErrorAction SilentlyContinue",
    );
    lines.push(`$env:OCPM_PROFILE = ${quotePowerShell(profile.name)}`);
    lines.push(`$env:OPENCODE_CONFIG_DIR = ${quotePowerShell(profile.dir)}`);
    if (disableProject) {
      lines.push(
        "$env:OPENCODE_DISABLE_PROJECT_CONFIG = '1'",
        "$env:OCPM_DISABLE_PROJECT_CONFIG = '1'",
      );
    }
  }
  const serviceEnv = await readServiceEnv(profile.dir);
  for (const [key, value] of Object.entries(serviceEnv)) lines.push(exportLine(shell, key, value));
  process.stdout.write(lines.join("\n") + "\n");
}
