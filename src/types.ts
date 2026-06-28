/**
 * WebMCP tool definition types.
 *
 * Based on the W3C WebMCP Community Group Draft Report (April 2026)
 * and Chrome 149 origin trial API surface.
 *
 * Not affiliated with or endorsed by Google or the W3C.
 */

// ── JSON Schema subset used by WebMCP inputSchema ──────────────────

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: (string | number | boolean)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

// ── WebMCP tool definition (mirrors the browser API) ───────────────

export interface ToolAnnotations {
  /** When true, indicates the tool only reads data and has no side effects. */
  readOnlyHint?: boolean;
  /** When true, indicates the tool handles untrusted/user-generated content. */
  untrustedContentHint?: boolean;
}

/**
 * A complete WebMCP tool definition ready for document.modelContext.registerTool().
 * The `execute` callback is emitted as a stub in the generated handler file.
 */
export interface WebMCPToolDefinition {
  /** Unique tool name (camelCase). */
  name: string;
  /** Human-readable description of what the tool does. */
  description: string;
  /** JSON Schema describing the tool's input parameters. */
  inputSchema: JsonSchemaObject;
  /** Optional annotations (e.g. readOnlyHint). */
  annotations?: ToolAnnotations;
}

// ── Generator output ───────────────────────────────────────────────

export interface GeneratedTool {
  /** The tool definition (JSON-serialisable). */
  definition: WebMCPToolDefinition;
  /** Generated TypeScript handler stub source code. */
  handlerStub: string;
}

export interface GenerationResult {
  /** Successfully generated tools. */
  tools: GeneratedTool[];
  /** Warnings encountered during parsing/generation. */
  warnings: string[];
  /** Errors that prevented generation for specific interfaces. */
  errors: string[];
}

// ── Validation ─────────────────────────────────────────────────────

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
