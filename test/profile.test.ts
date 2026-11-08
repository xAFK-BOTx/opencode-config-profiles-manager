import { describe, expect, it } from "vitest";
import { CliError } from "../dist/core/output.js";
import { currentProfile, profileDir, validateProfileName } from "../dist/core/profile.js";
import type { Paths } from "../dist/core/paths.js";

const paths: Paths = { bin: "opencode", configDir: "/base", profilesDir: "/base/profiles" };

describe("validateProfileName", () => {
  it("принимает корректные имена", () => {
    expect(() => validateProfileName("unity")).not.toThrow();
    expect(() => validateProfileName("work-2")).not.toThrow();
    expect(() => validateProfileName("a_b")).not.toThrow();
  });

  it("запрещает default", () => {
    expect(() => validateProfileName("default")).toThrow(CliError);
  });

  it("запрещает опасные имена", () => {
    expect(() => validateProfileName("../x")).toThrow(CliError);
    expect(() => validateProfileName("Work")).toThrow(CliError);
    expect(() => validateProfileName("a b")).toThrow(CliError);
  });
});

describe("profileDir", () => {
  it("строит путь внутри profiles", () => {
    expect(profileDir(paths, "unity")).toBe("/base/profiles/unity");
  });
});

describe("currentProfile", () => {
  it("возвращает default без env", () => {
    const saved = { ...process.env };
    delete process.env.OCPM_PROFILE;
    delete process.env.OPENCODE_CONFIG_DIR;
    expect(currentProfile(paths)).toBe("default");
    process.env = saved;
  });

  it("определяет профиль по OPENCODE_CONFIG_DIR", () => {
    const saved = { ...process.env };
    delete process.env.OCPM_PROFILE;
    process.env.OPENCODE_CONFIG_DIR = "/base/profiles/unity";
    expect(currentProfile(paths)).toBe("unity");
    process.env = saved;
  });

  it("определяет default по каталогу конфигурации", () => {
    const saved = { ...process.env };
    delete process.env.OCPM_PROFILE;
    process.env.OPENCODE_CONFIG_DIR = "/base";
    expect(currentProfile(paths)).toBe("default");
    process.env = saved;
  });
});
