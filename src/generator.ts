/**
 * Orchestrates parsing, validation, and file output.
 *
 * Reads a TypeScript file, generates WebMCP tool definitions,
 * validates them, and writes output files.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import { parseTypeScriptFile } from "./parser.js";
import { validateToolSet } from "./validator.js";
import type {
  GenerationResult,
  GeneratedTool,
  ValidationResult,
} from "./types.js";

export interface GenerateOptions {
  /** Path to the input TypeScript file. */
  inputFile: string;
  /** Output directory for generated files. Defaults to ./webmcp-out */
  outDir?: string;
  /** If true, only validate without writing files. */
  validateOnly?: boolean;
  /** If true, output a single combined file instead of per-tool files. */
  combined?: boolean;
}

export interface GenerateOutput {
  /** Parsing/generation result. */
  generation: GenerationResult;
  /** Validation result. */
  validation: ValidationResult;
  /** Files written (empty if validateOnly). */
  writtenFiles: string[];
}

/**
 * Main generation pipeline:
 *  1. Parse the TypeScript file
 *  2. Validate all generated tool definitions
 *  3. Write output files (unless validateOnly)
 */
export function generate(options: GenerateOptions): GenerateOutput {
  const { inputFile, outDir = "webmcp-out", validateOnly = false, combined = false } =
    options;

  // Step 1: Parse
  const generation = parseTypeScriptFile(inputFile);

  // Step 2: Validate
  const definitions = generation.tools.map((t) => t.definition);
  const validation = validateToolSet(definitions);

  // Step 3: Write files
  const writtenFiles: string[] = [];

  if (!validateOnly && generation.tools.length > 0) {
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    if (combined) {
      // Single combined output
      const defPath = join(outDir, "tools.webmcp.json");
      const handlersPath = join(outDir, "tools.handlers.ts");

      const allDefinitions = generation.tools.map((t) => t.definition);
      writeFileSync(defPath, JSON.stringify(allDefinitions, null, 2), "utf-8");
      writtenFiles.push(defPath);

      const ctxLine = '// Chrome 149: navigator.modelContext — Chrome 150+: document.modelContext\n'
        + 'const ctx = "modelContext" in document ? document.modelContext : navigator.modelContext;\n';
      const stubs = generation.tools
        .map((t) => t.handlerStub.replace(/\/\/ Chrome 149:.*\nconst ctx.*;\n\n/m, ""))
        .join("\n\n// " + "─".repeat(70) + "\n\n");
      writeFileSync(handlersPath, ctxLine + "\n" + stubs, "utf-8");
      writtenFiles.push(handlersPath);
    } else {
      // Per-tool output
      for (const tool of generation.tools) {
        const files = writeToolFiles(tool, outDir);
        writtenFiles.push(...files);
      }
    }
  }

  return { generation, validation, writtenFiles };
}

function writeToolFiles(tool: GeneratedTool, outDir: string): string[] {
  const files: string[] = [];
  const safeName = tool.definition.name;

  // Write JSON definition
  const defPath = join(outDir, `${safeName}.webmcp.json`);
  writeFileSync(
    defPath,
    JSON.stringify(tool.definition, null, 2),
    "utf-8"
  );
  files.push(defPath);

  // Write handler stub
  const handlerPath = join(outDir, `${safeName}.handler.ts`);
  writeFileSync(handlerPath, tool.handlerStub, "utf-8");
  files.push(handlerPath);

  return files;
}
