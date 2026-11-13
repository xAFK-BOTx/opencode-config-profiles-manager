import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function makeTemp(prefix = "ocpm-test-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function makeBase(): Promise<string> {
  const base = await makeTemp();
  await mkdir(join(base, "plugins", "foo"), { recursive: true });
  await mkdir(join(base, ".git"), { recursive: true });
  await mkdir(join(base, ".opencode", "board"), { recursive: true });
  await mkdir(join(base, "profiles", "existing"), { recursive: true });
  await writeFile(join(base, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }) + "\n");
  await writeFile(join(base, "cli.json"), JSON.stringify({ theme: "test" }) + "\n");
  await writeFile(join(base, "AGENTS.md"), "# rules\n");
  await writeFile(join(base, "plugins", "foo", "index.js"), "export default 1\n");
  await writeFile(join(base, "plugins", "foo", ".env"), "PLUGIN_SECRET=1\n");
  await writeFile(join(base, ".git", "config"), "gitdir: x\n");
  await writeFile(join(base, ".env"), "SECRET=1\n");
  await writeFile(join(base, "service.json"), JSON.stringify({ password: "secret", remote: { route: "x" } }) + "\n");
  await writeFile(join(base, ".npmrc"), "//registry.npmjs.org/:_authToken=secret\n");
  await writeFile(
    join(base, "profiles", "existing", "opencode.json"),
    JSON.stringify({ $schema: "https://opencode.ai/config.json" }) + "\n",
  );
  await writeFile(join(base, ".opencode", "board", "state"), "board\n");
  return base;
}

export async function makeFakeOpencode(dir: string): Promise<string> {
  const file = join(dir, process.platform === "win32" ? "fake-opencode.cmd" : "fake-opencode");
  const content =
    process.platform === "win32"
      ? [
          "@echo off",
          "if \"%~1\"==\"--version\" if \"%OCPM_FAKE_VERSION%\"==\"1\" (",
          "  echo 2.2.6",
          "  exit /b 0",
          ")",
          "if defined OPENCODE_CONFIG_DIR (echo ENV_OPENCODE_CONFIG_DIR=%OPENCODE_CONFIG_DIR%) else (echo ENV_OPENCODE_CONFIG_DIR=)",
          "if defined OCPM_PROFILE (echo ENV_OCPM_PROFILE=%OCPM_PROFILE%) else (echo ENV_OCPM_PROFILE=)",
          "if defined OPENCODE_DISABLE_PROJECT_CONFIG (echo ENV_OPENCODE_DISABLE_PROJECT_CONFIG=%OPENCODE_DISABLE_PROJECT_CONFIG%) else (echo ENV_OPENCODE_DISABLE_PROJECT_CONFIG=)",
          ":loop",
          "if \"%~1\"==\"\" goto end",
          "echo ARG:%~1",
          "shift",
          "goto loop",
          ":end",
          "",
        ].join("\r\n")
      : [
          "#!/bin/sh",
          'if [ "$1" = "--version" ] && [ "${OCPM_FAKE_VERSION-}" = "1" ]; then echo "2.2.6"; exit 0; fi',
          'echo "ENV_OPENCODE_CONFIG_DIR=${OPENCODE_CONFIG_DIR-}"',
          'echo "ENV_OCPM_PROFILE=${OCPM_PROFILE-}"',
          'echo "ENV_OPENCODE_DISABLE_PROJECT_CONFIG=${OPENCODE_DISABLE_PROJECT_CONFIG-}"',
          'for a in "$@"; do echo "ARG:$a"; done',
          "",
        ].join("\n");
  await writeFile(file, content, { mode: 0o755 });
  if (process.platform !== "win32") await chmod(file, 0o755);
  return file;
}

export function cliPath(): string {
  return join(process.cwd(), "dist", "cli.js");
}

export function runCli(args: string[], env: NodeJS.ProcessEnv = {}, cwd = process.cwd()) {
  return spawnSync(process.execPath, [cliPath(), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    cwd,
  });
}
