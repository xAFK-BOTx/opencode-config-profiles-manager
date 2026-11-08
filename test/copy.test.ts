import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyProfile, emptyProfile } from "../dist/core/copy.js";
import { readManifest } from "../dist/core/profile.js";
import { readService } from "../dist/core/service.js";
import type { Paths } from "../dist/core/paths.js";
import { makeBase } from "./helpers.js";

async function makePaths(): Promise<Paths> {
  const base = await makeBase();
  return { bin: "opencode", configDir: base, profilesDir: join(base, "profiles") };
}

describe("copyProfile", () => {
  it("копирует конфиг и исключает секреты и состояние", async () => {
    const paths = await makePaths();
    await copyProfile(paths, "unity", { sourceName: "default", sourceDir: paths.configDir });
    const dir = join(paths.profilesDir, "unity");

    expect(existsSync(join(dir, "opencode.json"))).toBe(true);
    expect(existsSync(join(dir, "cli.json"))).toBe(true);
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(dir, "plugins", "foo", "index.js"))).toBe(true);

    expect(existsSync(join(dir, ".git"))).toBe(false);
    expect(existsSync(join(dir, ".env"))).toBe(false);
    expect(existsSync(join(dir, ".npmrc"))).toBe(false);
    expect(existsSync(join(dir, "plugins", "foo", ".env"))).toBe(false);
    expect(existsSync(join(dir, ".opencode"))).toBe(false);
    expect(existsSync(join(dir, "profiles", "existing"))).toBe(false);

    expect(await readService(dir)).toEqual({ disabled: true });
    const manifest = await readManifest(dir);
    expect(manifest?.name).toBe("unity");
    expect(manifest?.source).toBe("default");
  });

  it("копирует из другого профиля", async () => {
    const paths = await makePaths();
    await copyProfile(paths, "unity", { sourceName: "default", sourceDir: paths.configDir });
    await copyProfile(paths, "work", { sourceName: "unity", sourceDir: join(paths.profilesDir, "unity") });
    const manifest = await readManifest(join(paths.profilesDir, "work"));
    expect(manifest?.source).toBe("unity");
    expect(await readService(join(paths.profilesDir, "work"))).toEqual({ disabled: true });
  });

  it("требует force для существующего профиля", async () => {
    const paths = await makePaths();
    await copyProfile(paths, "unity", { sourceName: "default", sourceDir: paths.configDir });
    await expect(
      copyProfile(paths, "unity", { sourceName: "default", sourceDir: paths.configDir }),
    ).rejects.toThrow();
    await expect(
      copyProfile(paths, "unity", { sourceName: "default", sourceDir: paths.configDir, force: true }),
    ).resolves.toBeDefined();
  });
});

describe("emptyProfile", () => {
  it("создаёт минимальный профиль", async () => {
    const paths = await makePaths();
    await emptyProfile(paths, "empty");
    const dir = join(paths.profilesDir, "empty");
    const config = JSON.parse(await readFile(join(dir, "opencode.json"), "utf8"));
    expect(config.$schema).toBe("https://opencode.ai/config.json");
    expect(await readService(dir)).toEqual({ disabled: true });
    expect((await readManifest(dir))?.source).toBe("empty");
  });
});
