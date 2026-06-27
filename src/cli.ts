#!/usr/bin/env node

/**
 * webmcp-gen CLI
 *
 * Generate WebMCP tool definitions from TypeScript interfaces.
 *
 * Usage:
 *   webmcp-gen --api myapp.ts              # generate from TS file
 *   webmcp-gen --api myapp.ts -o out/      # custom output directory
 *   webmcp-gen --api myapp.ts --validate   # validate only (no files written)
 *   webmcp-gen --api myapp.ts --combined   # single combined output file
 *   webmcp-gen --template crud-api         # emit example template
 *   webmcp-gen --list-templates            # list available templates
 */

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

import { generate } from "./generator.js";
import { getTemplate, TEMPLATES } from "./templates.js";

const VERSION = "1.0.0";

const program = new Command();

program
  .name("webmcp-gen")
  .description(
    "Generate WebMCP tool definitions from TypeScript interfaces.\n" +
    "Built with AI assistance. Not affiliated with or endorsed by Google or the W3C."
  )
  .version(VERSION);

// ── Main command: generate from TypeScript ─────────────────────────

program
  .option("--api <file>", "TypeScript file to parse (interfaces become tools)")
  .option("-o, --out <dir>", "Output directory", "webmcp-out")
  .option("--validate", "Validate only — do not write files")
  .option("--combined", "Output a single combined file instead of per-tool files")
  .option("--template <name>", "Emit an example template to the current directory")
  .option("--list-templates", "List available example templates");

program.action((opts) => {
  // ── List templates ───────────────────────────────────────────
  if (opts.listTemplates) {
    console.log(chalk.bold("\nAvailable templates:\n"));
    for (const t of TEMPLATES) {
      console.log(`  ${chalk.cyan(t.name.padEnd(20))} ${t.description}`);
    }
    console.log(
      `\nUsage: ${chalk.dim("webmcp-gen --template <name>")}\n`
    );
    return;
  }

  // ── Emit template ────────────────────────────────────────────
  if (opts.template) {
    const template = getTemplate(opts.template);
    if (!template) {
      console.error(
        chalk.red(
          `Unknown template "${opts.template}". Run --list-templates to see options.`
        )
      );
      process.exit(1);
    }

    const outPath = join(process.cwd(), template.filename);
    if (existsSync(outPath)) {
      console.error(
        chalk.red(`File already exists: ${outPath}`)
      );
      process.exit(1);
    }

    writeFileSync(outPath, template.content, "utf-8");
    console.log(
      chalk.green(`\n  Created ${template.filename}\n`) +
      chalk.dim(`  Run: webmcp-gen --api ${template.filename}\n`)
    );
    return;
  }

  // ── Generate from TypeScript ─────────────────────────────────
  if (!opts.api) {
    console.log(program.helpInformation());
    return;
  }

  const inputFile = resolve(opts.api);
  if (!existsSync(inputFile)) {
    console.error(chalk.red(`File not found: ${inputFile}`));
    process.exit(1);
  }

  const outDir = resolve(opts.out);
  const validateOnly = !!opts.validate;
  const combined = !!opts.combined;

  console.log(chalk.bold("\nwebmcp-gen") + chalk.dim(` v${VERSION}\n`));
  console.log(chalk.dim(`  Input:  ${inputFile}`));
  if (!validateOnly) {
    console.log(chalk.dim(`  Output: ${outDir}`));
  }
  console.log();

  try {
    const result = generate({ inputFile, outDir, validateOnly, combined });
    const { generation, validation, writtenFiles } = result;

    // Report generation
    if (generation.tools.length === 0) {
      console.log(
        chalk.yellow("  No tools generated.") +
        (generation.warnings.length > 0
          ? "\n" + generation.warnings.map((w) => chalk.yellow(`    ${w}`)).join("\n")
          : "")
      );
      process.exit(1);
    }

    console.log(
      chalk.green(`  ${generation.tools.length} tool(s) generated:\n`)
    );
    for (const tool of generation.tools) {
      const props = Object.keys(tool.definition.inputSchema.properties).length;
      const required = tool.definition.inputSchema.required?.length ?? 0;
      const readOnly = tool.definition.annotations?.readOnlyHint
        ? chalk.dim(" [read-only]")
        : "";
      console.log(
        `    ${chalk.cyan(tool.definition.name)} — ${props} properties, ${required} required${readOnly}`
      );
    }

    // Report warnings
    if (generation.warnings.length > 0) {
      console.log(chalk.yellow("\n  Warnings:"));
      for (const w of generation.warnings) {
        console.log(chalk.yellow(`    - ${w}`));
      }
    }

    // Report errors
    if (generation.errors.length > 0) {
      console.log(chalk.red("\n  Errors:"));
      for (const e of generation.errors) {
        console.log(chalk.red(`    - ${e}`));
      }
    }

    // Report validation
    console.log();
    if (validation.valid) {
      console.log(chalk.green("  Validation: PASSED"));
    } else {
      console.log(chalk.red("  Validation: FAILED"));
    }

    const validationErrors = validation.issues.filter(
      (i) => i.severity === "error"
    );
    const validationWarnings = validation.issues.filter(
      (i) => i.severity === "warning"
    );

    if (validationErrors.length > 0) {
      for (const issue of validationErrors) {
        console.log(chalk.red(`    ERROR  ${issue.path}: ${issue.message}`));
      }
    }
    if (validationWarnings.length > 0) {
      for (const issue of validationWarnings) {
        console.log(
          chalk.yellow(`    WARN   ${issue.path}: ${issue.message}`)
        );
      }
    }

    // Report written files
    if (writtenFiles.length > 0) {
      console.log(chalk.dim(`\n  Files written:`));
      for (const f of writtenFiles) {
        console.log(chalk.dim(`    ${f}`));
      }
    } else if (!validateOnly) {
      console.log(chalk.dim("\n  No files written."));
    } else {
      console.log(chalk.dim("\n  Validate-only mode — no files written."));
    }

    console.log();

    // Exit code: non-zero if validation failed
    if (!validation.valid) {
      process.exit(1);
    }
  } catch (err) {
    console.error(
      chalk.red(
        `\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`
      )
    );
    process.exit(1);
  }
});

program.parse();
