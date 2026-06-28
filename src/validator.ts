/**
 * Validates WebMCP tool definitions against the spec.
 *
 * Checks:
 *  - name: non-empty string, valid identifier
 *  - description: non-empty string
 *  - inputSchema: valid JSON Schema (type: "object" at root)
 *  - annotations: if present, must have valid fields
 */

import type {
  WebMCPToolDefinition,
  JsonSchemaObject,
  JsonSchemaProperty,
  ValidationResult,
  ValidationIssue,
} from "./types.js";

const VALID_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const VALID_SCHEMA_TYPES = [
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
] as const;

/**
 * Validate a single WebMCP tool definition.
 */
export function validateToolDefinition(
  tool: WebMCPToolDefinition
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // ── name ───────────────────────────────────────────────────────
  if (!tool.name || typeof tool.name !== "string") {
    issues.push({
      path: "name",
      message: "Tool name is required and must be a non-empty string.",
      severity: "error",
    });
  } else if (!VALID_NAME_PATTERN.test(tool.name)) {
    issues.push({
      path: "name",
      message: `Tool name "${tool.name}" must be a valid identifier (letters, digits, underscores; cannot start with a digit).`,
      severity: "error",
    });
  } else if (tool.name.length > 128) {
    issues.push({
      path: "name",
      message: "Tool name should be 128 characters or fewer.",
      severity: "warning",
    });
  }

  // ── description ────────────────────────────────────────────────
  if (!tool.description || typeof tool.description !== "string") {
    issues.push({
      path: "description",
      message:
        "Tool description is required and must be a non-empty string.",
      severity: "error",
    });
  } else if (tool.description.length < 10) {
    issues.push({
      path: "description",
      message:
        "Tool description is very short. A clear description helps AI agents use the tool correctly.",
      severity: "warning",
    });
  } else if (tool.description.length > 1024) {
    issues.push({
      path: "description",
      message: "Tool description exceeds 1024 characters.",
      severity: "warning",
    });
  }

  // ── inputSchema ────────────────────────────────────────────────
  if (!tool.inputSchema) {
    issues.push({
      path: "inputSchema",
      message: "inputSchema is required.",
      severity: "error",
    });
  } else {
    validateSchema(tool.inputSchema, "inputSchema", issues);
  }

  // ── annotations ────────────────────────────────────────────────
  if (tool.annotations !== undefined) {
    if (typeof tool.annotations !== "object" || tool.annotations === null) {
      issues.push({
        path: "annotations",
        message: "Annotations must be an object.",
        severity: "error",
      });
    } else {
      const allowed = new Set(["readOnlyHint", "untrustedContentHint"]);
      for (const key of Object.keys(tool.annotations)) {
        if (!allowed.has(key)) {
          issues.push({
            path: `annotations.${key}`,
            message: `Unknown annotation "${key}". Known annotations: ${[...allowed].join(", ")}.`,
            severity: "warning",
          });
        }
      }
      for (const hint of ["readOnlyHint", "untrustedContentHint"] as const) {
        const val = (tool.annotations as Record<string, unknown>)[hint];
        if (val !== undefined && typeof val !== "boolean") {
          issues.push({
            path: `annotations.${hint}`,
            message: `${hint} must be a boolean.`,
            severity: "error",
          });
        }
      }
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

/**
 * Validate multiple tool definitions, including cross-tool uniqueness.
 */
export function validateToolSet(
  tools: WebMCPToolDefinition[]
): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Check for duplicate names
  const seen = new Map<string, number>();
  for (let i = 0; i < tools.length; i++) {
    const name = tools[i].name;
    if (seen.has(name)) {
      allIssues.push({
        path: `tools[${i}].name`,
        message: `Duplicate tool name "${name}" (first seen at index ${seen.get(name)}).`,
        severity: "error",
      });
    } else {
      seen.set(name, i);
    }
  }

  // Validate each tool
  for (let i = 0; i < tools.length; i++) {
    const result = validateToolDefinition(tools[i]);
    for (const issue of result.issues) {
      allIssues.push({
        ...issue,
        path: `tools[${i}].${issue.path}`,
      });
    }
  }

  return {
    valid: allIssues.every((i) => i.severity !== "error"),
    issues: allIssues,
  };
}

// ── Schema validation ──────────────────────────────────────────────

function validateSchema(
  schema: JsonSchemaObject,
  path: string,
  issues: ValidationIssue[]
): void {
  if (schema.type !== "object") {
    issues.push({
      path: `${path}.type`,
      message: `Root inputSchema must have type "object", got "${schema.type}".`,
      severity: "error",
    });
    return;
  }

  if (!schema.properties || typeof schema.properties !== "object") {
    issues.push({
      path: `${path}.properties`,
      message: "inputSchema.properties is required and must be an object.",
      severity: "error",
    });
    return;
  }

  if (Object.keys(schema.properties).length === 0) {
    issues.push({
      path: `${path}.properties`,
      message:
        "inputSchema has no properties. Tools with no parameters are unusual.",
      severity: "warning",
    });
  }

  // Validate each property
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    validateProperty(propSchema, `${path}.properties.${propName}`, issues);
  }

  // Validate required array
  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required)) {
      issues.push({
        path: `${path}.required`,
        message: '"required" must be an array of strings.',
        severity: "error",
      });
    } else {
      const propertyNames = new Set(Object.keys(schema.properties));
      for (const req of schema.required) {
        if (!propertyNames.has(req)) {
          issues.push({
            path: `${path}.required`,
            message: `Required property "${req}" is not defined in properties.`,
            severity: "error",
          });
        }
      }
    }
  }
}

function validateProperty(
  schema: JsonSchemaProperty,
  path: string,
  issues: ValidationIssue[]
): void {
  if (!schema.type) {
    issues.push({
      path: `${path}.type`,
      message: "Property must have a type.",
      severity: "error",
    });
    return;
  }

  if (!VALID_SCHEMA_TYPES.includes(schema.type as any)) {
    issues.push({
      path: `${path}.type`,
      message: `Invalid type "${schema.type}". Valid types: ${VALID_SCHEMA_TYPES.join(", ")}.`,
      severity: "error",
    });
  }

  // Array items
  if (schema.type === "array") {
    if (!schema.items) {
      issues.push({
        path: `${path}.items`,
        message: 'Array properties should have an "items" schema.',
        severity: "warning",
      });
    } else {
      validateProperty(schema.items, `${path}.items`, issues);
    }
  }

  // Nested object
  if (schema.type === "object" && schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      validateProperty(propSchema, `${path}.properties.${propName}`, issues);
    }
  }

  // Enum values
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      issues.push({
        path: `${path}.enum`,
        message: "Enum must be a non-empty array.",
        severity: "error",
      });
    }
  }

  // Numeric constraints
  if (
    (schema.type === "number" || schema.type === "integer") &&
    schema.minimum !== undefined &&
    schema.maximum !== undefined &&
    schema.minimum > schema.maximum
  ) {
    issues.push({
      path,
      message: `minimum (${schema.minimum}) is greater than maximum (${schema.maximum}).`,
      severity: "error",
    });
  }
}
