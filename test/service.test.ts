import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ensureServiceDisabled,
  hasInvalidEnv,
  hasSecret,
  readService,
  readServiceEnv,
  serviceEnv,
} from "../dist/core/service.js";
import { makeTemp } from "./helpers.js";

describe("service.json", () => {
  it("создаёт disabled при отсутствии", async () => {
    const dir = await makeTemp();
    const result = await ensureServiceDisabled(dir);
    expect(result).toEqual({ ok: true, created: true });
    expect(await readService(dir)).toEqual({ disabled: true });
  });

  it("не перезаписывает существующий не-disabled файл", async () => {
    const dir = await makeTemp();
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(join(dir, "service.json"), JSON.stringify({ password: "secret" }) + "\n"),
    );
    const result = await ensureServiceDisabled(dir);
    expect(result).toEqual({ ok: false, created: false });
    expect(hasSecret(await readService(dir))).toBe(true);
  });

  it("не перезаписывает некорректный JSON", async () => {
    const dir = await makeTemp();
    await import("node:fs/promises").then((fs) => fs.writeFile(join(dir, "service.json"), "{"));
    const result = await ensureServiceDisabled(dir);
    expect(result).toEqual({ ok: false, created: false });
    expect(await readFile(join(dir, "service.json"), "utf8")).toBe("{");
  });

  it("отдаёт env из service.json", async () => {
    const dir = await makeTemp();
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(
        join(dir, "service.json"),
        JSON.stringify({ disabled: true, env: { OPENCODE_DISABLE_PROJECT_CONFIG: "1" } }) + "\n",
      ),
    );
    expect(await readServiceEnv(dir)).toEqual({ OPENCODE_DISABLE_PROJECT_CONFIG: "1" });
  });

  it("пропускает не-строки, чужие имена и XDG_STATE_HOME", () => {
    expect(
      serviceEnv({
        env: {
          GOOD: "1",
          BAD_VALUE: 1,
          "bad-key": "1",
          XDG_STATE_HOME: "/tmp/state",
        },
      }),
    ).toEqual({ GOOD: "1" });
  });

  it("считает некорректным не-объект или не-строки", () => {
    expect(hasInvalidEnv({ env: { A: "1" } })).toBe(false);
    expect(hasInvalidEnv({})).toBe(false);
    expect(hasInvalidEnv({ env: "A=1" })).toBe(true);
    expect(hasInvalidEnv({ env: { A: 1 } })).toBe(true);
  });
});
