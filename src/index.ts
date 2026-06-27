/**
 * webmcp-gen — public API
 *
 * Generate WebMCP tool definitions from TypeScript interfaces.
 */

export { parseTypeScriptFile } from "./parser.js";
export { validateToolDefinition, validateToolSet } from "./validator.js";
export { generate } from "./generator.js";
export { getTemplate, listTemplateNames, TEMPLATES } from "./templates.js";
export type {
  WebMCPToolDefinition,
  JsonSchemaObject,
  JsonSchemaProperty,
  ToolAnnotations,
  GeneratedTool,
  GenerationResult,
  ValidationResult,
  ValidationIssue,
} from "./types.js";
export type { GenerateOptions, GenerateOutput } from "./generator.js";
export type { Template } from "./templates.js";
