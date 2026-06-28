---
title: "webmcp-gen: Generate Chrome WebMCP Tool Definitions from TypeScript"
published: false
tags: webmcp, chrome, typescript, ai
---

Chrome 149 just shipped WebMCP — a browser-native API that lets web pages expose structured tools to AI agents via `navigator.modelContext`. It's in origin trial now, and if you're building for it, you'll notice there's no codegen tooling yet.

**webmcp-gen** fills that gap. Write your API as TypeScript interfaces, run one command, get spec-compliant WebMCP tool definitions + handler stubs with security best practices baked in.

## Quick example

```typescript
// api.ts

/** Search products by keyword. */
interface SearchProducts {
  query: string;
  category?: "electronics" | "clothing" | "home";
  limit?: number;
}
```

```bash
npx webmcp-gen --api api.ts
```

Output: a `.webmcp.json` definition + a `.handler.ts` stub with `navigator.modelContext.registerTool()` wired up and ready to implement.

## What it does

- Parses TypeScript interfaces and type aliases via ts-morph
- Maps TS types to JSON Schema (strings, numbers, enums, arrays, nested objects, optionals)
- Pulls descriptions from JSDoc comments
- Validates output against the WebMCP spec
- Generates handler stubs with Google's security guidance built in:
  - `requestUserInteraction()` reminders for mutating tools
  - Input sanitisation warnings for freeform string inputs
  - `readOnlyHint` annotations for query-only tools

## Install

```bash
npm install -g webmcp-gen
```

Includes 4 starter templates (CRUD, search, form handler, data transformer) to get you going:

```bash
webmcp-gen --template crud-api
webmcp-gen --api crud-api.ts
```

MIT licensed. Contributions welcome.

**GitHub:** https://github.com/oliuntangled/webmcp-gen
**npm:** https://www.npmjs.com/package/webmcp-gen

---

*Not affiliated with or endorsed by Google or the W3C. Built with AI assistance.*
