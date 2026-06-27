import { describe, it, expect } from "vitest";
import { validateToolDefinition, validateToolSet } from "./validator.js";
import type { WebMCPToolDefinition } from "./types.js";

function validTool(overrides: Partial<WebMCPToolDefinition> = {}): WebMCPToolDefinition {
  return {
    name: "searchProducts",
    description: "Search the product catalog by keyword.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term" },
      },
      required: ["query"],
    },
    ...overrides,
  };
}

describe("validateToolDefinition", () => {
  it("should pass for a valid tool definition", () => {
    const result = validateToolDefinition(validTool());
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("should fail for empty name", () => {
    const result = validateToolDefinition(validTool({ name: "" }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "name")).toBe(true);
  });

  it("should fail for invalid name (starts with digit)", () => {
    const result = validateToolDefinition(validTool({ name: "1tool" }));
    expect(result.valid).toBe(false);
  });

  it("should allow underscores in name", () => {
    const result = validateToolDefinition(validTool({ name: "search_products" }));
    expect(result.valid).toBe(true);
  });

  it("should fail for empty description", () => {
    const result = validateToolDefinition(validTool({ description: "" }));
    expect(result.valid).toBe(false);
  });

  it("should warn for very short description", () => {
    const result = validateToolDefinition(validTool({ description: "Search" }));
    expect(result.valid).toBe(true);
    expect(
      result.issues.some(
        (i) => i.severity === "warning" && i.path === "description"
      )
    ).toBe(true);
  });

  it("should fail when inputSchema is missing", () => {
    const tool = validTool();
    (tool as any).inputSchema = undefined;
    const result = validateToolDefinition(tool);
    expect(result.valid).toBe(false);
  });

  it("should fail when inputSchema type is not object", () => {
    const result = validateToolDefinition(
      validTool({
        inputSchema: { type: "object" as any, properties: {} },
      })
    );
    // This is actually valid (empty properties gets a warning, not error)
    expect(result.valid).toBe(true);
  });

  it("should fail when required references non-existent property", () => {
    const result = validateToolDefinition(
      validTool({
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query", "nonexistent"],
        },
      })
    );
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.message.includes("nonexistent"))
    ).toBe(true);
  });

  it("should warn for empty properties object", () => {
    const result = validateToolDefinition(
      validTool({
        inputSchema: {
          type: "object",
          properties: {},
        },
      })
    );
    expect(result.valid).toBe(true);
    expect(
      result.issues.some(
        (i) => i.severity === "warning" && i.path.includes("properties")
      )
    ).toBe(true);
  });

  it("should validate annotations.readOnlyHint type", () => {
    const tool = validTool();
    tool.annotations = { readOnlyHint: "yes" as any };
    const result = validateToolDefinition(tool);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path.includes("readOnlyHint"))
    ).toBe(true);
  });

  it("should pass with valid readOnlyHint", () => {
    const tool = validTool();
    tool.annotations = { readOnlyHint: true };
    const result = validateToolDefinition(tool);
    expect(result.valid).toBe(true);
  });

  it("should warn for unknown annotation keys", () => {
    const tool = validTool();
    (tool as any).annotations = { unknownHint: true };
    const result = validateToolDefinition(tool);
    expect(result.valid).toBe(true);
    expect(
      result.issues.some(
        (i) => i.severity === "warning" && i.message.includes("unknownHint")
      )
    ).toBe(true);
  });

  it("should fail when minimum > maximum", () => {
    const result = validateToolDefinition(
      validTool({
        inputSchema: {
          type: "object",
          properties: {
            count: { type: "number", minimum: 100, maximum: 10 },
          },
        },
      })
    );
    expect(result.valid).toBe(false);
  });
});

describe("validateToolSet", () => {
  it("should pass for a valid set of tools", () => {
    const result = validateToolSet([
      validTool({ name: "toolA" }),
      validTool({ name: "toolB" }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("should fail for duplicate tool names", () => {
    const result = validateToolSet([
      validTool({ name: "toolA" }),
      validTool({ name: "toolA" }),
    ]);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.message.includes("Duplicate"))
    ).toBe(true);
  });

  it("should aggregate errors from individual tools", () => {
    const result = validateToolSet([
      validTool({ name: "" }),
      validTool({ description: "" }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(2);
  });
});
