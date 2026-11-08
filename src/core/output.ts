import pc from "picocolors";

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

export function info(message: string): void {
  console.log(message);
}

export function success(message: string): void {
  console.log(pc.green(message));
}

export function warn(message: string): void {
  console.error(pc.yellow(`ocpm: ${message}`));
}

export function error(message: string): void {
  console.error(pc.red(`ocpm: ${message}`));
}

export function table(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => (row[index] ?? "").length)));
  return rows
    .map((row) => row.map((cell, index) => (cell ?? "").padEnd(widths[index])).join("  ").trimEnd())
    .join("\n");
}
