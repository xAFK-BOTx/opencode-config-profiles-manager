import { describe, expect, it } from "vitest";
import { buildProfileEnv, buildRunArgs } from "../dist/core/opencode.js";
import type { Profile } from "../dist/core/profile.js";

const profile: Profile = { name: "unity", dir: "/base/profiles/unity", isDefault: false };
const defaultProfile: Profile = { name: "default", dir: "/base", isDefault: true };

describe("buildProfileEnv", () => {
  it("ставит OPENCODE_CONFIG_DIR и OCPM_PROFILE", () => {
    const env = buildProfileEnv(profile, {
      OPENCODE_CONFIG: "/tmp/override.json",
      OPENCODE_CONFIG_CONTENT: "{}",
    });
    expect(env.OPENCODE_CONFIG_DIR).toBe("/base/profiles/unity");
    expect(env.OCPM_PROFILE).toBe("unity");
    expect(env.OPENCODE_CONFIG).toBeUndefined();
    expect(env.OPENCODE_CONFIG_CONTENT).toBeUndefined();
  });

  it("убирает переменные для default", () => {
    const env = buildProfileEnv(defaultProfile, {
      OPENCODE_CONFIG_DIR: "/base/profiles/unity",
      OCPM_PROFILE: "unity",
    });
    expect(env.OPENCODE_CONFIG_DIR).toBeUndefined();
    expect(env.OCPM_PROFILE).toBeUndefined();
  });

  it("отключает project config внутри каталога конфигурации", () => {
    const env = buildProfileEnv(profile, {}, { configDir: "/base", cwd: "/base" });
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe("1");
    expect(env.OCPM_DISABLE_PROJECT_CONFIG).toBe("1");
  });

  it("не отключает project config в обычном проекте", () => {
    const env = buildProfileEnv(profile, {}, { configDir: "/base", cwd: "/project" });
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBeUndefined();
    expect(env.OCPM_DISABLE_PROJECT_CONFIG).toBeUndefined();
  });

  it("снимает project config для default, если ставил ocpm", () => {
    const env = buildProfileEnv(defaultProfile, {
      OPENCODE_DISABLE_PROJECT_CONFIG: "1",
      OCPM_DISABLE_PROJECT_CONFIG: "1",
    });
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBeUndefined();
    expect(env.OCPM_DISABLE_PROJECT_CONFIG).toBeUndefined();
  });

  it("снимает project config при переходе в обычный проект", () => {
    const env = buildProfileEnv(
      profile,
      { OPENCODE_DISABLE_PROJECT_CONFIG: "1", OCPM_DISABLE_PROJECT_CONFIG: "1" },
      { configDir: "/base", cwd: "/project" },
    );
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBeUndefined();
    expect(env.OCPM_DISABLE_PROJECT_CONFIG).toBeUndefined();
  });

  it("переносит env из service.json в окружение профиля", () => {
    const env = buildProfileEnv(profile, {}, { serviceEnv: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } });
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe("1");
  });

  it("env из service.json перекрывает project config в проекте", () => {
    const env = buildProfileEnv(
      profile,
      { OPENCODE_DISABLE_PROJECT_CONFIG: "1", OCPM_DISABLE_PROJECT_CONFIG: "1" },
      { configDir: "/base", cwd: "/project", serviceEnv: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } },
    );
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe("1");
  });

  it("переносит env из service.json в default", () => {
    const env = buildProfileEnv(defaultProfile, {}, { serviceEnv: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } });
    expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe("1");
    expect(env.OPENCODE_CONFIG_DIR).toBeUndefined();
  });
});

describe("buildRunArgs", () => {
  it("не добавляет --standalone при disabled service", () => {
    expect(buildRunArgs(profile, ["--version"], true)).toEqual(["--version"]);
  });

  it("добавляет --standalone при общем сервисе", () => {
    expect(buildRunArgs(profile, ["--version"], false)).toEqual(["--standalone", "--version"]);
  });

  it("не добавляет --standalone для serve и plugin", () => {
    expect(buildRunArgs(profile, ["serve"], false)).toEqual(["serve"]);
    expect(buildRunArgs(profile, ["plugin", "add", "x"], false)).toEqual(["plugin", "add", "x"]);
  });

  it("не добавляет --standalone для default", () => {
    expect(buildRunArgs(defaultProfile, ["--version"], false)).toEqual(["--version"]);
  });
});
