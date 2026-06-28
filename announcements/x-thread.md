# X Thread Draft — @oliuntangled

## Tweet 1
Chrome 149 just shipped WebMCP — pages can now expose structured tools to AI agents natively.

But there's no codegen tooling yet.

So I built webmcp-gen: TypeScript interfaces in → spec-compliant WebMCP definitions out.

One command. Open source.

npm install -g webmcp-gen

🧵👇

## Tweet 2
How it works:

1. Write your API as TS interfaces
2. Run: npx webmcp-gen --api myapp.ts
3. Get JSON tool definitions + handler stubs

It maps types → JSON Schema, pulls JSDoc → descriptions, and validates against the spec automatically.

## Tweet 3
Security matters here — WebMCP lets agents execute tools on live web apps.

webmcp-gen bakes in Google's own guidance:
→ requestUserInteraction() for mutating actions
→ Input sanitisation for prompt injection
→ readOnlyHint annotations for safe queries

## Tweet 4
Includes 4 starter templates:
• CRUD API
• Search/filter
• Form handler
• Data transformer

Run: webmcp-gen --template crud-api

Then: webmcp-gen --api crud-api.ts

Full docs + source: github.com/oliuntangled/webmcp-gen

MIT licensed. PRs welcome.
