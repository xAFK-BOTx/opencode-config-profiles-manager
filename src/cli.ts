#!/usr/bin/env node
import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { doctorCommand } from "./commands/doctor.js";
import { envCommand } from "./commands/env.js";
import { execCommand } from "./commands/exec.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { pathCommand } from "./commands/path.js";
import { removeCommand } from "./commands/remove.js";
import { runCommand } from "./commands/run.js";
import { shellCommand } from "./commands/shell.js";
import { whichCommand } from "./commands/which.js";
import { CliError, error } from "./core/output.js";
import { readVersion } from "./version.js";

interface GlobalOptions {
  bin?: string;
  baseDir?: string;
  profilesDir?: string;
}

const program = new Command();

program
  .name("ocpm")
  .description("Профили OpenCode как отдельные каталоги конфигурации")
  .version(readVersion())
  .option("--bin <path>", "путь к opencode")
  .option("--base-dir <path>", "каталог конфигурации OpenCode")
  .option("--profiles-dir <path>", "каталог профилей")
  .enablePositionalOptions();

function pathOptions(): GlobalOptions {
  return program.opts<GlobalOptions>();
}

program
  .command("init")
  .description("Создать каталог профилей")
  .action(async () => {
    await initCommand(pathOptions());
  });

program
  .command("create <name>")
  .description("Создать профиль")
  .option("--from <profile>", "источник", "default")
  .option("--empty", "пустой профиль")
  .option("--force", "перезаписать существующий")
  .action(async (name: string, options: { from?: string; empty?: boolean; force?: boolean }) => {
    await createCommand(name, { ...pathOptions(), ...options });
  });

program
  .command("list")
  .description("Список профилей")
  .action(async () => {
    await listCommand(pathOptions());
  });

program
  .command("run <name> [args...]")
  .description("Запустить OpenCode с профилем")
  .passThroughOptions()
  .allowUnknownOption(true)
  .action(async (name: string, args: string[]) => {
    await runCommand(name, args ?? [], pathOptions());
  });

program
  .command("exec <name> [args...]")
  .description("Выполнить команду с окружением профиля")
  .passThroughOptions()
  .allowUnknownOption(true)
  .action(async (name: string, args: string[]) => {
    await execCommand(name, args ?? [], pathOptions());
  });

program
  .command("shell <name>")
  .description("Запустить shell с окружением профиля")
  .action(async (name: string) => {
    await shellCommand(name, pathOptions());
  });

program
  .command("env <name>")
  .description("Напечатать export-команды для профиля")
  .option("--shell <shell>", "sh, fish или powershell")
  .action(async (name: string, options: { shell?: string }) => {
    await envCommand(name, { ...pathOptions(), ...options });
  });

program
  .command("path <name>")
  .description("Путь к профилю")
  .action(async (name: string) => {
    await pathCommand(name, pathOptions());
  });

program
  .command("which")
  .description("Текущий профиль")
  .action(async () => {
    await whichCommand(pathOptions());
  });

program
  .command("remove <name>")
  .description("Удалить профиль")
  .option("--force", "удалить активный профиль")
  .action(async (name: string, options: { force?: boolean }) => {
    await removeCommand(name, { ...pathOptions(), ...options });
  });

program
  .command("doctor [name]")
  .description("Проверить профили")
  .option("--fix", "создать отсутствующий service.json")
  .action(async (name: string | undefined, options: { fix?: boolean }) => {
    await doctorCommand(name, { ...pathOptions(), ...options });
  });

program.parseAsync(process.argv).catch((cause: unknown) => {
  if (cause instanceof CliError) {
    error(cause.message);
    process.exitCode = cause.exitCode;
    return;
  }
  error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
});
