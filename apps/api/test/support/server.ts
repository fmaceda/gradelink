import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { vi } from "vitest";

export async function listen(app: Express) {
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

// Everything written to stdout, stderr or the console from now until `stop()`. The request log
// line is written when the response closes, which can land just after the client has read it,
// so `waitFor` polls rather than reading once.
export function captureOutput() {
  const chunks: string[] = [];
  const record = (chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  };
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation(record),
    vi.spyOn(process.stderr, "write").mockImplementation(record),
    ...(["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        record(args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(" "));
      }),
    ),
  ];
  const text = () => chunks.join("");

  return {
    text,
    async waitFor(pattern: string | RegExp, timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      const matches = () =>
        typeof pattern === "string" ? text().includes(pattern) : pattern.test(text());
      while (!matches()) {
        if (Date.now() > deadline) {
          throw new Error(`No output matched ${String(pattern)}. Output was:\n${text()}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return text();
    },
    stop() {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
  };
}
