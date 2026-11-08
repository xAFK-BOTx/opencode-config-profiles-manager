import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureServiceDisabled, hasSecret, readService } from "../dist/core/service.js";
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
});
