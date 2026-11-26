// ARCHITECTURE.md rule 5: nothing in student/ may import from teacher/, directly or through
// re-exports (for example via common/ or the package's own index).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const PACKAGE_NAME = "@gradelink/shared";

// Static imports and re-exports, side-effect imports, and dynamic import().
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

type Source = (file: string) => string | undefined;

function readSource(file: string) {
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

function resolveSpecifier(specifier: string, fromFile: string, src: string) {
  if (specifier.startsWith(".")) return resolve(dirname(fromFile), specifier);
  // A self-import of the package goes through src/index.ts, which re-exports teacher/.
  if (specifier === PACKAGE_NAME || specifier.startsWith(`${PACKAGE_NAME}/`)) {
    return join(src, "index.ts");
  }
  return undefined; // zod and other packages
}

// Returns each import chain that starts in student/ and reaches a file in teacher/.
function findTeacherImports(entries: string[], src: string, read: Source): string[] {
  const teacherDir = join(src, "teacher") + sep;
  const violations: string[] = [];
  const visited = new Set<string>();
  const queue = entries.map((file) => [file]);

  while (queue.length > 0) {
    const chain = queue.shift() ?? [];
    const file = chain.at(-1) ?? "";
    if (visited.has(file)) continue;
    visited.add(file);

    if (file.startsWith(teacherDir)) {
      violations.push(chain.map((step) => relative(src, step)).join(" -> "));
      continue;
    }
    const text = read(file);
    if (text === undefined) continue;
    for (const match of text.matchAll(SPECIFIER)) {
      const target = resolveSpecifier(match[1] ?? "", file, src);
      if (target !== undefined) queue.push([...chain, target]);
    }
  }
  return violations;
}

function studentFiles(src: string) {
  return readdirSync(join(src, "student"), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(src, "student", name));
}

describe("student/ import boundary", () => {
  it("has student files to check", () => {
    expect(studentFiles(SRC).length).toBeGreaterThan(0);
  });

  it("never reaches teacher/, directly or through re-exports", () => {
    expect(findTeacherImports(studentFiles(SRC), SRC, readSource)).toEqual([]);
  });

  describe("the checker itself", () => {
    const src = resolve("/virtual/src");
    const file = (path: string) => join(src, ...path.split("/"));

    function check(files: Record<string, string>) {
      const sources = new Map(Object.entries(files).map(([path, text]) => [file(path), text]));
      const entries = [...sources.keys()].filter((path) => path.startsWith(file("student/")));
      return findTeacherImports(entries, src, (path) => sources.get(path));
    }

    it.each([
      ["a direct import", { "student/a.ts": 'import { x } from "../teacher/question.ts";' }],
      ["a type-only import", { "student/a.ts": 'import type { X } from "../teacher/index.ts";' }],
      ["a re-export", { "student/a.ts": 'export * from "../teacher/index.ts";' }],
      ["a dynamic import", { "student/a.ts": 'const m = await import("../teacher/test.ts");' }],
      [
        "a re-export through common/",
        {
          "student/a.ts": 'import { x } from "../common/index.ts";',
          "common/index.ts": 'export * from "../teacher/question.ts";',
        },
      ],
      [
        "a self-import of the package",
        {
          "student/a.ts": 'import { x } from "@gradelink/shared";',
          "index.ts": 'export * from "./teacher/index.ts";',
        },
      ],
    ])("catches %s", (_label, files) => {
      expect(check(files)).not.toEqual([]);
    });

    it("allows imports from common/ and zod", () => {
      expect(
        check({
          "student/a.ts": 'import { z } from "zod";\nimport { y } from "../common/ids.ts";',
          "common/ids.ts": 'import { z } from "zod";',
        }),
      ).toEqual([]);
    });
  });
});
