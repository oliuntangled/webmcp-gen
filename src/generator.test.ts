import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { generate } from "./generator.js";

const TEST_DIR = join(process.cwd(), "__test_gen_fixtures__");
const OUT_DIR = join(TEST_DIR, "out");

function fixture(name: string, content: string): string {
  const path = join(TEST_DIR, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("generate", () => {
  it("should generate per-tool output files", () => {
    const inputFile = fixture(
      "api.ts",
      `
      /** Search products. */
      interface SearchProducts {
        query: string;
      }

      /** Delete a product. */
      interface DeleteProduct {
        productId: string;
      }
      `
    );

    const result = generate({ inputFile, outDir: OUT_DIR });

    expect(result.generation.tools).toHaveLength(2);
    expect(result.validation.valid).toBe(true);
    expect(result.writtenFiles).toHaveLength(4); // 2 tools * 2 files each

    // Check JSON definition file
    const jsonPath = join(OUT_DIR, "searchProducts.webmcp.json");
    expect(existsSync(jsonPath)).toBe(true);
    const jsonContent = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(jsonContent.name).toBe("searchProducts");

    // Check handler stub
    const handlerPath = join(OUT_DIR, "searchProducts.handler.ts");
    expect(existsSync(handlerPath)).toBe(true);
    const handlerContent = readFileSync(handlerPath, "utf-8");
    expect(handlerContent).toContain("ctx.registerTool(");
  });

  it("should generate combined output when combined=true", () => {
    const inputFile = fixture(
      "combined.ts",
      `
      interface ToolA { name: string; }
      interface ToolB { id: number; }
      `
    );

    const result = generate({
      inputFile,
      outDir: OUT_DIR,
      combined: true,
    });

    expect(result.writtenFiles).toHaveLength(2); // 1 JSON + 1 handlers
    expect(result.writtenFiles[0]).toContain("tools.webmcp.json");
    expect(result.writtenFiles[1]).toContain("tools.handlers.ts");

    const jsonContent = JSON.parse(
      readFileSync(result.writtenFiles[0], "utf-8")
    );
    expect(jsonContent).toHaveLength(2);
  });

  it("should not write files in validate-only mode", () => {
    const inputFile = fixture(
      "validate.ts",
      `
      interface Ping { message: string; }
      `
    );

    const result = generate({
      inputFile,
      outDir: OUT_DIR,
      validateOnly: true,
    });

    expect(result.generation.tools).toHaveLength(1);
    expect(result.writtenFiles).toHaveLength(0);
    expect(existsSync(OUT_DIR)).toBe(false);
  });

  it("should report validation issues without crashing", () => {
    const inputFile = fixture(
      "edge.ts",
      `
      interface EmptyTool {}
      `
    );

    const result = generate({ inputFile, outDir: OUT_DIR });

    // Should still generate (even if empty properties)
    expect(result.generation.tools).toHaveLength(1);
    // Validation should warn about empty properties
    expect(
      result.validation.issues.some((i) =>
        i.message.includes("no properties")
      )
    ).toBe(true);
  });
});
