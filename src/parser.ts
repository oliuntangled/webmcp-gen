/**
 * TypeScript AST parser — reads interfaces and type aliases from .ts files
 * and converts them into WebMCP-compatible JSON Schema + handler stubs.
 *
 * Uses ts-morph for reliable AST traversal.
 */

import {
  Project,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  PropertySignature,
  SyntaxKind,
  Type,
  Node,
  SourceFile,
} from "ts-morph";

import type {
  JsonSchemaProperty,
  JsonSchemaObject,
  WebMCPToolDefinition,
  GeneratedTool,
  GenerationResult,
} from "./types.js";

// ── Public API ─────────────────────────────────────────────────────

/**
 * Parse a TypeScript file and generate WebMCP tool definitions
 * for every exported interface and type alias found.
 */
export function parseTypeScriptFile(filePath: string): GenerationResult {
  const project = new Project({ compilerOptions: { strict: true } });
  const sourceFile = project.addSourceFileAtPath(filePath);

  const tools: GeneratedTool[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Process interfaces
  for (const iface of sourceFile.getInterfaces()) {
    try {
      const tool = processInterface(iface, sourceFile);
      tools.push(tool);
    } catch (err) {
      errors.push(
        `Failed to process interface "${iface.getName()}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Process type aliases that resolve to object shapes
  for (const alias of sourceFile.getTypeAliases()) {
    try {
      const tool = processTypeAlias(alias, sourceFile);
      if (tool) {
        tools.push(tool);
      } else {
        warnings.push(
          `Skipped type "${alias.getName()}" — only object-shaped types are supported.`
        );
      }
    } catch (err) {
      errors.push(
        `Failed to process type "${alias.getName()}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (tools.length === 0 && errors.length === 0) {
    warnings.push(
      "No interfaces or object type aliases found in the file."
    );
  }

  return { tools, warnings, errors };
}

// ── Interface processing ───────────────────────────────────────────

function processInterface(
  iface: InterfaceDeclaration,
  _sourceFile: SourceFile
): GeneratedTool {
  const name = iface.getName();
  const toolName = toToolName(name);
  const description = extractJsDoc(iface) || `Tool generated from ${name}`;

  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const prop of iface.getProperties()) {
    const propName = prop.getName();
    const schema = propertyToSchema(prop);
    properties[propName] = schema;

    if (!prop.hasQuestionToken()) {
      required.push(propName);
    }
  }

  const inputSchema: JsonSchemaObject = {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };

  const definition: WebMCPToolDefinition = {
    name: toolName,
    description,
    inputSchema,
  };

  const jsDocTags = getJsDocTags(iface);
  const annotations: Record<string, boolean> = {};
  if (jsDocTags.includes("readonly") || jsDocTags.includes("readOnly")) {
    annotations.readOnlyHint = true;
  }
  if (jsDocTags.includes("untrusted") || jsDocTags.includes("untrustedContent")) {
    annotations.untrustedContentHint = true;
  }
  if (Object.keys(annotations).length > 0) {
    definition.annotations = annotations;
  }

  const handlerStub = generateHandlerStub(definition, name);

  return { definition, handlerStub };
}

// ── Type alias processing ──────────────────────────────────────────

function processTypeAlias(
  alias: TypeAliasDeclaration,
  _sourceFile: SourceFile
): GeneratedTool | null {
  const aliasType = alias.getType();

  // Only process object-shaped types
  if (!aliasType.isObject() || aliasType.isArray()) {
    return null;
  }

  const name = alias.getName();
  const toolName = toToolName(name);
  const description = extractJsDoc(alias) || `Tool generated from ${name}`;

  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const prop of aliasType.getProperties()) {
    const propName = prop.getName();
    const declarations = prop.getDeclarations();
    const decl = declarations[0];

    if (decl && Node.isPropertySignature(decl)) {
      const schema = propertyToSchema(decl);
      properties[propName] = schema;

      if (!decl.hasQuestionToken()) {
        required.push(propName);
      }
    } else {
      // Fallback: try to derive from type
      const propType = prop.getTypeAtLocation(alias);
      const schema = typeToSchema(propType);
      properties[propName] = schema;

      // If no declaration with ? token, assume required
      if (decl && Node.isPropertySignature(decl)) {
        if (!decl.hasQuestionToken()) {
          required.push(propName);
        }
      } else {
        required.push(propName);
      }
    }
  }

  if (Object.keys(properties).length === 0) {
    return null;
  }

  const inputSchema: JsonSchemaObject = {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };

  const definition: WebMCPToolDefinition = {
    name: toolName,
    description,
    inputSchema,
  };

  const handlerStub = generateHandlerStub(definition, name);
  return { definition, handlerStub };
}

// ── Property → JSON Schema conversion ──────────────────────────────

function propertyToSchema(prop: PropertySignature): JsonSchemaProperty {
  const propType = prop.getType();
  const schema = typeToSchema(propType);

  // Pull description from JSDoc if available
  const jsDoc = prop
    .getJsDocs()
    .map((d) => d.getDescription().trim())
    .filter(Boolean)
    .join(" ");
  if (jsDoc) {
    schema.description = jsDoc;
  }

  return schema;
}

function typeToSchema(type: Type): JsonSchemaProperty {
  // String
  if (type.isString() || type.isStringLiteral()) {
    return { type: "string" };
  }

  // Number
  if (type.isNumber() || type.isNumberLiteral()) {
    return { type: "number" };
  }

  // Boolean
  if (type.isBoolean() || type.isBooleanLiteral()) {
    return { type: "boolean" };
  }

  // Union handling — first strip `undefined` from optional types
  if (type.isUnion()) {
    const unionTypes = type.getUnionTypes().filter((t) => !t.isUndefined());

    // If stripping undefined leaves a single type, recurse on it
    if (unionTypes.length === 1) {
      return typeToSchema(unionTypes[0]);
    }

    const allLiterals = unionTypes.every(
      (t) => t.isStringLiteral() || t.isNumberLiteral() || t.isBooleanLiteral()
    );

    if (allLiterals) {
      const values = unionTypes.map((t) => {
        if (t.isStringLiteral()) return t.getLiteralValue() as string;
        if (t.isNumberLiteral()) return t.getLiteralValue() as number;
        if (t.isBooleanLiteral()) return t.getLiteralValue() as unknown as boolean;
        return String(t.getText());
      });

      // Determine type from first value
      const firstVal = values[0];
      const enumType =
        typeof firstVal === "string"
          ? "string"
          : typeof firstVal === "number"
            ? "number"
            : "string";

      return { type: enumType, enum: values };
    }

    // Mixed union — fallback to string
    return { type: "string" };
  }

  // Array
  if (type.isArray()) {
    const elementType = type.getArrayElementType();
    const items = elementType ? typeToSchema(elementType) : { type: "string" as const };
    return { type: "array", items };
  }

  // Nested object
  if (type.isObject() && !type.isArray()) {
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];

    for (const prop of type.getProperties()) {
      const propName = prop.getName();
      const declarations = prop.getDeclarations();
      const decl = declarations[0];

      if (decl && Node.isPropertySignature(decl)) {
        properties[propName] = propertyToSchema(decl);
        if (!decl.hasQuestionToken()) {
          required.push(propName);
        }
      } else {
        const propType = prop.getTypeAtLocation(
          prop.getValueDeclaration() || declarations[0]!
        );
        properties[propName] = typeToSchema(propType);
        required.push(propName);
      }
    }

    if (Object.keys(properties).length > 0) {
      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
  }

  // Fallback
  return { type: "string" };
}

// ── Handler stub generation ────────────────────────────────────────

function generateHandlerStub(
  def: WebMCPToolDefinition,
  originalTypeName: string
): string {
  const params = Object.entries(def.inputSchema.properties)
    .map(([name, schema]) => {
      const tsType = schemaTypeToTS(schema);
      const optional =
        !def.inputSchema.required?.includes(name) ? "?" : "";
      return `  ${name}${optional}: ${tsType};`;
    })
    .join("\n");

  const inputType = `${originalTypeName}Input`;
  const isReadOnly = !!def.annotations?.readOnlyHint;
  const readOnlyComment = isReadOnly
    ? "\n// Annotations: { readOnlyHint: true }"
    : "";

  const hasStringInputs = Object.values(def.inputSchema.properties).some(
    (p) => p.type === "string" && !p.enum
  );

  const securityLines: string[] = [];
  if (hasStringInputs) {
    securityLines.push(
      "    // SECURITY: Sanitise freeform string inputs before use.",
      "    // WebMCP tool data may contain indirect prompt injection — validate and escape."
    );
  }
  if (!isReadOnly) {
    securityLines.push(
      "    // SECURITY: This tool performs a mutating action.",
      "    // Use requestUserInteraction() to confirm sensitive operations before executing.",
      "    // See: https://developer.chrome.com/docs/ai/webmcp"
    );
  }
  const securityBlock = securityLines.length > 0
    ? securityLines.join("\n") + "\n\n"
    : "";

  return `/**
 * WebMCP Tool: ${def.name}
 * ${def.description}
 *
 * Generated by webmcp-gen — do not edit the definition block.
 * Implement your logic in the execute callback below.
 */

interface ${inputType} {
${params}
}
${readOnlyComment}
// Chrome 149: navigator.modelContext — Chrome 150+: document.modelContext
const ctx = "modelContext" in document ? document.modelContext : navigator.modelContext;

ctx.registerTool({
  name: "${def.name}",
  description: "${escapeString(def.description)}",
  inputSchema: ${JSON.stringify(def.inputSchema, null, 4).replace(/\n/g, "\n  ")},${def.annotations ? `\n  annotations: ${JSON.stringify(def.annotations)},` : ""}
  execute: async (input: ${inputType}): Promise<string> => {
${securityBlock}    // TODO: Implement ${def.name} logic here
    throw new Error("Not implemented: ${def.name}");
  },
});
`;
}

function schemaTypeToTS(schema: JsonSchemaProperty): string {
  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return schema.enum.map((v) => `"${v}"`).join(" | ");
      }
      return "string";
    case "number":
    case "integer":
      if (schema.enum) {
        return schema.enum.map((v) => String(v)).join(" | ");
      }
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      if (schema.items) {
        return `${schemaTypeToTS(schema.items)}[]`;
      }
      return "unknown[]";
    case "object":
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([k, v]) => {
            const opt = !schema.required?.includes(k) ? "?" : "";
            return `${k}${opt}: ${schemaTypeToTS(v)}`;
          })
          .join("; ");
        return `{ ${props} }`;
      }
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function toToolName(typeName: string): string {
  // Convert PascalCase to camelCase
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
}

function extractJsDoc(node: InterfaceDeclaration | TypeAliasDeclaration): string | undefined {
  const docs = node.getJsDocs();
  if (docs.length === 0) return undefined;
  const text = docs
    .map((d) => d.getDescription().trim())
    .filter(Boolean)
    .join(" ");
  return text || undefined;
}

function getJsDocTags(node: InterfaceDeclaration): string[] {
  const tags: string[] = [];
  for (const doc of node.getJsDocs()) {
    for (const tag of doc.getTags()) {
      tags.push(tag.getTagName());
    }
  }
  return tags;
}

function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
