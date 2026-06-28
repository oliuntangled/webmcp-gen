import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseTypeScriptFile } from "./parser.js";

const TEST_DIR = join(process.cwd(), "__test_fixtures__");

function fixture(name: string, content: string): string {
  const path = join(TEST_DIR, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

beforeEach(() => {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ── Basic interface parsing ────────────────────────────────────────

describe("parseTypeScriptFile", () => {
  it("should parse a simple interface into a tool definition", () => {
    const path = fixture(
      "simple.ts",
      `
      /** Search for products by keyword. */
      interface SearchProducts {
        /** The search query. */
        query: string;
        /** Max results to return. */
        limit?: number;
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(1);

    const tool = result.tools[0];
    expect(tool.definition.name).toBe("searchProducts");
    expect(tool.definition.description).toBe(
      "Search for products by keyword."
    );
    expect(tool.definition.inputSchema.type).toBe("object");
    expect(tool.definition.inputSchema.properties.query.type).toBe("string");
    expect(tool.definition.inputSchema.properties.limit.type).toBe("number");
    expect(tool.definition.inputSchema.required).toEqual(["query"]);
  });

  it("should handle multiple interfaces", () => {
    const path = fixture(
      "multi.ts",
      `
      interface CreateUser {
        name: string;
        email: string;
      }
      interface DeleteUser {
        userId: string;
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0].definition.name).toBe("createUser");
    expect(result.tools[1].definition.name).toBe("deleteUser");
  });

  it("should handle enum/union types", () => {
    const path = fixture(
      "enums.ts",
      `
      interface FilterItems {
        category: "electronics" | "clothing" | "home";
        inStock: boolean;
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    const props = result.tools[0].definition.inputSchema.properties;
    expect(props.category.enum).toEqual(["electronics", "clothing", "home"]);
    expect(props.inStock.type).toBe("boolean");
  });

  it("should handle array types", () => {
    const path = fixture(
      "arrays.ts",
      `
      interface BulkCreate {
        items: string[];
        quantities: number[];
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    const props = result.tools[0].definition.inputSchema.properties;
    expect(props.items.type).toBe("array");
    expect(props.items.items?.type).toBe("string");
    expect(props.quantities.type).toBe("array");
    expect(props.quantities.items?.type).toBe("number");
  });

  it("should detect @readonly JSDoc tag and set readOnlyHint", () => {
    const path = fixture(
      "readonly.ts",
      `
      /**
       * Get current balance.
       * @readonly
       */
      interface GetBalance {
        accountId: string;
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    expect(result.tools[0].definition.annotations?.readOnlyHint).toBe(true);
  });

  it("should handle type aliases with object shape", () => {
    const path = fixture(
      "typealias.ts",
      `
      /** Rename a file. */
      type RenameFile = {
        oldPath: string;
        newPath: string;
      };
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].definition.name).toBe("renameFile");
    expect(
      Object.keys(result.tools[0].definition.inputSchema.properties)
    ).toEqual(["oldPath", "newPath"]);
  });

  it("should skip non-object type aliases with a warning", () => {
    const path = fixture(
      "primitivealias.ts",
      `
      type Status = "active" | "inactive";
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.tools).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should handle nested object types", () => {
    const path = fixture(
      "nested.ts",
      `
      interface CreateOrder {
        product: string;
        shipping: {
          street: string;
          city: string;
          postcode: string;
        };
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    const shipping = result.tools[0].definition.inputSchema.properties.shipping;
    expect(shipping.type).toBe("object");
    expect(shipping.properties?.street.type).toBe("string");
  });

  it("should generate handler stubs with proper TypeScript", () => {
    const path = fixture(
      "handler.ts",
      `
      /** Add a todo item. */
      interface AddTodo {
        text: string;
        priority?: number;
      }
      `
    );

    const result = parseTypeScriptFile(path);

    const stub = result.tools[0].handlerStub;
    expect(stub).toContain('ctx.registerTool(');
    expect(stub).toContain('"addTodo"');
    expect(stub).toContain("AddTodoInput");
    expect(stub).toContain("text: string");
    expect(stub).toContain("priority?: number");
    expect(stub).toContain("TODO: Implement");
  });

  it("should warn when file has no interfaces or types", () => {
    const path = fixture(
      "empty.ts",
      `
      const x = 42;
      function foo() { return x; }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.tools).toHaveLength(0);
    expect(result.warnings).toContain(
      "No interfaces or object type aliases found in the file."
    );
  });

  it("should handle all-optional properties (no required array)", () => {
    const path = fixture(
      "alloptional.ts",
      `
      interface UpdateSettings {
        theme?: string;
        fontSize?: number;
        notifications?: boolean;
      }
      `
    );

    const result = parseTypeScriptFile(path);

    expect(result.errors).toHaveLength(0);
    const schema = result.tools[0].definition.inputSchema;
    expect(schema.required).toBeUndefined();
  });
});
