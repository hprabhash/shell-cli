import ts from "typescript";
import { describe, expect, it } from "vitest";

import { raw, serializeObjectLiteral } from "../../src/codegen/serialize-object";

describe("serializeObjectLiteral", () => {
  it("serializes primitives and quotes strings", () => {
    expect(serializeObjectLiteral({ a: "x", b: 1, c: true, d: null })).toBe(
      '{\n  a: "x",\n  b: 1,\n  c: true,\n  d: null,\n}',
    );
  });

  it("serializes nested objects and arrays", () => {
    const result = serializeObjectLiteral({ nested: { a: 1 }, list: ["x", "y"] });
    expect(result).toContain("nested: {\n    a: 1,\n  }");
    expect(result).toContain('list: [\n    "x",\n    "y",\n  ]');
  });

  it("emits raw() leaves verbatim, unquoted", () => {
    const result = serializeObjectLiteral({ value: raw("process.env.FOO as string") });
    expect(result).toBe("{\n  value: process.env.FOO as string,\n}");
  });

  it("quotes non-identifier keys", () => {
    const result = serializeObjectLiteral({ "weird-key": 1, normalKey: 2 });
    expect(result).toContain('"weird-key": 1');
    expect(result).toContain("normalKey: 2");
  });

  it("produces an empty object literal for an empty object", () => {
    expect(serializeObjectLiteral({})).toBe("{}");
  });

  it("round-trips through the TypeScript compiler with zero diagnostics", () => {
    const literal = serializeObjectLiteral({
      database: raw('new Database("./sqlite.db")'),
      emailAndPassword: { enabled: true },
      plugins: [raw("twoFactor()"), raw("admin()")],
    });
    const source = `const auth = ${literal};\nexport default auth;\n`;
    const result = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    expect(result.diagnostics ?? []).toHaveLength(0);
  });
});
