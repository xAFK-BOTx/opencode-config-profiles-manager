import { existsSync } from "node:fs";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeBase, makeFakeOpencode, runCli } from "./helpers.js";

async function setup() {
  const base = await makeBase();
  const fake = await makeFakeOpencode(base);
  const env = {
    OCPM_BASE_DIR: base,
    OCPM_OPENCODE_BIN: fake,
    OPENCODE_CONFIG_DIR: "",
    OCPM_PROFILE: "",
  };
  return { base, fake, env };
}

describe("ocpm cli", () => {
  it("init создаёт каталог профилей", async () => {
    const { base, env } = await setup();
    const result = runCli(["init"], env);
    expect(result.status).toBe(0);
    expect(existsSync(join(base, "profiles"))).toBe(true);
  });

  it("create и list", async () => {
    const { base, env } = await setup();
    const create = runCli(["create", "unity", "--from", "default"], env);
    expect(create.status).toBe(0);
    expect(existsSync(join(base, "profiles", "unity", "opencode.json"))).toBe(true);
    const list = runCli(["list"], env);
    expect(list.stdout).toContain("unity");
    expect(list.stdout).toContain("default");
  });

  it("create --empty", async () => {
    const { base, env } = await setup();
    const result = runCli(["create", "empty", "--empty"], env);
    expect(result.status).toBe(0);
    expect(existsSync(join(base, "profiles", "empty", "opencode.json"))).toBe(true);
  });

  it("path и which", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    expect(runCli(["path", "unity"], env).stdout.trim()).toBe(join(base, "profiles", "unity"));
    expect(runCli(["which"], env).stdout.trim()).toBe("default");
    expect(runCli(["which"], { ...env, OCPM_PROFILE: "unity" }).stdout.trim()).toBe("unity");
  });

  it("env для sh, fish и powershell", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const sh = runCli(["env", "unity", "--shell", "sh"], env);
    expect(sh.stdout).toContain(`export OPENCODE_CONFIG_DIR='${join(base, "profiles", "unity")}'`);
    const fish = runCli(["env", "unity", "--shell", "fish"], env);
    expect(fish.stdout).toContain("set -gx OPENCODE_CONFIG_DIR");
    const pwsh = runCli(["env", "unity", "--shell", "powershell"], env);
    expect(pwsh.stdout).toContain("$env:OPENCODE_CONFIG_DIR");
    const def = runCli(["env", "default", "--shell", "sh"], env);
    expect(def.stdout).toContain("unset OCPM_PROFILE OPENCODE_CONFIG_DIR");
  });

  it("env из каталога конфигурации отключает project config", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const result = runCli(["env", "unity", "--shell", "sh"], env, base);
    expect(result.stdout).toContain("export OPENCODE_DISABLE_PROJECT_CONFIG=1");
    expect(result.stdout).toContain("export OCPM_DISABLE_PROJECT_CONFIG=1");
  });

  it("env default снимает project config, если ставил ocpm", async () => {
    const { env } = await setup();
    const result = runCli(["env", "default", "--shell", "sh"], {
      ...env,
      OPENCODE_DISABLE_PROJECT_CONFIG: "1",
      OCPM_DISABLE_PROJECT_CONFIG: "1",
    });
    expect(result.stdout).toContain("unset OPENCODE_DISABLE_PROJECT_CONFIG OCPM_DISABLE_PROJECT_CONFIG");
  });

  it("env профиля снимает project config при переходе из каталога конфигурации", async () => {
    const { env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const result = runCli(["env", "unity", "--shell", "sh"], {
      ...env,
      OPENCODE_DISABLE_PROJECT_CONFIG: "1",
      OCPM_DISABLE_PROJECT_CONFIG: "1",
    });
    expect(result.stdout).toContain("unset OPENCODE_DISABLE_PROJECT_CONFIG OCPM_DISABLE_PROJECT_CONFIG");
  });

  it("env профиля сохраняет project config при переключении внутри каталога конфигурации", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const result = runCli(
      ["env", "unity", "--shell", "sh"],
      {
        ...env,
        OPENCODE_DISABLE_PROJECT_CONFIG: "1",
        OCPM_DISABLE_PROJECT_CONFIG: "1",
      },
      base,
    );
    expect(result.stdout).toContain("export OPENCODE_DISABLE_PROJECT_CONFIG=1");
    expect(result.stdout).not.toContain("unset OPENCODE_DISABLE_PROJECT_CONFIG");
  });

  it("run передаёт env и аргументы", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const result = runCli(["run", "unity", "--", "--version"], env);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`ENV_OPENCODE_CONFIG_DIR=${join(base, "profiles", "unity")}`);
    expect(result.stdout).toContain("ENV_OCPM_PROFILE=unity");
    expect(result.stdout).toContain("ARG:--version");
  });

  it("run default убирает env", async () => {
    const { env } = await setup();
    const result = runCli(["run", "default", "--", "--version"], env);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ENV_OPENCODE_CONFIG_DIR=\n");
    expect(result.stdout).toContain("ENV_OCPM_PROFILE=\n");
  });

  it("run добавляет --standalone при общем сервисе", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    await writeFile(join(base, "profiles", "unity", "service.json"), "{}\n");
    const result = runCli(["run", "unity", "--", "--version"], env);
    expect(result.stdout).toContain("ARG:--standalone");
  });

  it("exec выполняет команду с env профиля", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const result = runCli(
      ["exec", "unity", "--", process.execPath, "-e", "console.log(process.env.OPENCODE_CONFIG_DIR)"],
      env,
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(join(base, "profiles", "unity"));
  });

  it("run передаёт env из service.json профиля", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    await writeFile(
      join(base, "profiles", "unity", "service.json"),
      JSON.stringify({ disabled: true, env: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } }) + "\n",
    );
    const result = runCli(["run", "unity", "--", "--version"], env);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ENV_OPENCODE_DISABLE_PROJECT_CONFIG=1");
  });

  it("exec передаёт env из service.json профиля", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    await writeFile(
      join(base, "profiles", "unity", "service.json"),
      JSON.stringify({ disabled: true, env: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } }) + "\n",
    );
    const result = runCli(
      ["exec", "unity", "--", process.execPath, "-e", "console.log(process.env.OPENCODE_DISABLE_PROJECT_CONFIG)"],
      env,
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("1");
  });

  it("env печатает env из service.json", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    await writeFile(
      join(base, "profiles", "unity", "service.json"),
      JSON.stringify({ disabled: true, env: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } }) + "\n",
    );
    const sh = runCli(["env", "unity", "--shell", "sh"], env);
    expect(sh.stdout).toContain("export OPENCODE_DISABLE_PROJECT_CONFIG='1'");
    const fish = runCli(["env", "unity", "--shell", "fish"], env);
    expect(fish.stdout).toContain("set -gx OPENCODE_DISABLE_PROJECT_CONFIG '1'");
    const pwsh = runCli(["env", "unity", "--shell", "powershell"], env);
    expect(pwsh.stdout).toContain("$env:OPENCODE_DISABLE_PROJECT_CONFIG = '1'");
  });

  it("doctor проверяет профиль", async () => {
    const { env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    const result = runCli(["doctor", "unity"], { ...env, OCPM_FAKE_VERSION: "1" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("unity: ok");
    expect(result.stdout).toContain("OpenCode: v2.2.6");
  });

  it("doctor --fix создаёт service.json", async () => {
    const { base, env } = await setup();
    const dir = join(base, "profiles", "broken");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "opencode.json"), "{}\n");
    const result = runCli(["doctor", "broken", "--fix"], env);
    expect(result.status).toBe(0);
    expect(existsSync(join(dir, "service.json"))).toBe(true);
  });

  it("doctor возвращает ошибку при битом JSONC", async () => {
    const { base, env } = await setup();
    const dir = join(base, "profiles", "broken");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "opencode.json"), "{\n");
    const result = runCli(["doctor", "broken"], env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ошибка JSONC");
  });

  it.skipIf(process.platform === "win32")("doctor предупреждает о битой ссылке в плагине", async () => {
    const { base, env } = await setup();
    const dir = join(base, "profiles", "broken");
    await mkdir(join(dir, "plugins"), { recursive: true });
    await writeFile(join(dir, "opencode.json"), "{}\n");
    await symlink("../../missing", join(dir, "plugins", "missing"));
    const result = runCli(["doctor", "broken"], env);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("битая ссылка");
  });

  it("remove удаляет профиль и запрещает default", async () => {
    const { base, env } = await setup();
    runCli(["create", "unity", "--from", "default"], env);
    expect(runCli(["remove", "unity"], env).status).toBe(0);
    expect(existsSync(join(base, "profiles", "unity"))).toBe(false);
    expect(runCli(["remove", "default"], env).status).toBe(1);
  });
});
