import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getTemplate, listTemplateNames, TEMPLATES } from "./templates.js";
import { parseTypeScriptFile } from "./parser.js";

const TEST_DIR = join(process.cwd(), "__test_tpl_fixtures__");

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("templates", () => {
  it("should have at least 3 templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it("should return template by name", () => {
    const tpl = getTemplate("crud-api");
    expect(tpl).toBeDefined();
    expect(tpl!.name).toBe("crud-api");
    expect(tpl!.content.length).toBeGreaterThan(100);
  });

  it("should return undefined for unknown template", () => {
    expect(getTemplate("nonexistent")).toBeUndefined();
  });

  it("should list all template names", () => {
    const names = listTemplateNames();
    expect(names).toContain("crud-api");
    expect(names).toContain("search");
    expect(names).toContain("form-handler");
    expect(names).toContain("data-transformer");
  });

  // Verify each template actually parses successfully
  for (const template of TEMPLATES) {
    it(`template "${template.name}" should parse without errors`, () => {
      mkdirSync(TEST_DIR, { recursive: true });
      const path = join(TEST_DIR, template.filename);
      writeFileSync(path, template.content, "utf-8");

      const result = parseTypeScriptFile(path);

      expect(result.errors).toHaveLength(0);
      expect(result.tools.length).toBeGreaterThan(0);

      // Every generated tool should have valid structure
      for (const tool of result.tools) {
        expect(tool.definition.name).toBeTruthy();
        expect(tool.definition.description).toBeTruthy();
        expect(tool.definition.inputSchema.type).toBe("object");
        expect(tool.handlerStub).toContain("navigator.modelContext.registerTool");
      }
    });
  }
});
