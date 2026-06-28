"""Post the webmcp-gen announcement to DEV.to."""

import os
import sys
import json
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(env_path)

api_key = os.getenv("DEVTO_API_KEY")
if not api_key:
    print("ERROR: Missing DEVTO_API_KEY in .env")
    sys.exit(1)

article = {
    "article": {
        "title": "webmcp-gen: Generate Chrome WebMCP Tool Definitions from TypeScript",
        "published": False,
        "tags": ["webmcp", "chrome", "typescript", "ai"],
        "body_markdown": (
            "Chrome 149 shipped WebMCP — a browser-native API that lets web pages "
            "expose structured tools to AI agents via `navigator.modelContext`. The "
            "ecosystem is forming fast: [webmcp-core](https://github.com/keak-ai/webmcp-core) "
            "crawls live sites to auto-generate tool definitions, and "
            "[@webmcp-registry/kit](https://github.com/WebMCP-Registry/kit) provides a "
            "runtime SDK with Zod-based `defineTool()`.\n\n"
            "What's missing is **build-time codegen from your existing TypeScript**. "
            "If you already have typed interfaces for your API, you shouldn't have to "
            "rewrite them as Zod schemas or wait for a crawler to discover them.\n\n"
            "**webmcp-gen** fills that gap. Write your API as TypeScript interfaces, run "
            "one command, get spec-compliant WebMCP tool definitions + handler stubs with "
            "security best practices baked in.\n\n"
            "## Where it fits\n\n"
            "| Tool | Approach | When to use |\n"
            "|---|---|---|\n"
            "| **webmcp-core** | Crawl a live URL | You have a site, want tools auto-discovered |\n"
            "| **@webmcp-registry/kit** | Zod schemas at runtime | You want runtime registration + React hooks |\n"
            "| **webmcp-gen** | TypeScript interfaces at build time | You have typed TS, want static JSON + stubs |\n\n"
            "They're complementary — different layers for different workflows.\n\n"
            "## Quick example\n\n"
            "```typescript\n"
            "// api.ts\n\n"
            "/** Search products by keyword. */\n"
            "interface SearchProducts {\n"
            "  query: string;\n"
            '  category?: "electronics" | "clothing" | "home";\n'
            "  limit?: number;\n"
            "}\n"
            "```\n\n"
            "```bash\n"
            "npx webmcp-gen --api api.ts\n"
            "```\n\n"
            "Output: a `.webmcp.json` definition + a `.handler.ts` stub with "
            "`navigator.modelContext.registerTool()` wired up and ready to implement.\n\n"
            "## What it does\n\n"
            "- Parses TypeScript interfaces and type aliases via ts-morph\n"
            "- Maps TS types to JSON Schema (strings, numbers, enums, arrays, nested objects, optionals)\n"
            "- Pulls descriptions from JSDoc comments\n"
            "- Validates output against the WebMCP spec\n"
            "- Generates handler stubs with Google's security guidance built in:\n"
            "  - `requestUserInteraction()` reminders for mutating tools\n"
            "  - Input sanitisation warnings for freeform string inputs\n"
            "  - `readOnlyHint` annotations for query-only tools\n\n"
            "## Security by default\n\n"
            "WebMCP allows AI agents to execute tools that affect live web applications. "
            "Google advises using human-in-the-loop hooks and protecting against indirect "
            "prompt injection. webmcp-gen bakes this into every generated handler stub — "
            "mutating tools get `requestUserInteraction()` reminders, freeform inputs get "
            "sanitisation warnings. Safe defaults, not afterthoughts.\n\n"
            "## Install\n\n"
            "```bash\n"
            "npm install -g webmcp-gen\n"
            "```\n\n"
            "Includes 4 starter templates (CRUD, search, form handler, data transformer) "
            "to get you going:\n\n"
            "```bash\n"
            "webmcp-gen --template crud-api\n"
            "webmcp-gen --api crud-api.ts\n"
            "```\n\n"
            "MIT licensed. Contributions welcome.\n\n"
            "## v1.2.0 — security-hardened release\n\n"
            "The current npm version (v1.2.0) has been through a 4-agent security audit "
            "covering line-by-line diff scanning, cross-file tracing, removed-behavior "
            "analysis, and dedicated security review. 10 findings were fixed before public "
            "announcement, including injection hardening in generated code, path traversal "
            "protection, and Chrome 150 compatibility (the origin trial API moved from "
            "`navigator.modelContext` to `document.modelContext`). Full changelog in the "
            "[README](https://github.com/oliuntangled/webmcp-gen#changelog).\n\n"
            "**GitHub:** [oliuntangled/webmcp-gen](https://github.com/oliuntangled/webmcp-gen)\n"
            "**npm:** [webmcp-gen](https://www.npmjs.com/package/webmcp-gen)\n\n"
            "---\n\n"
            "*Not affiliated with or endorsed by Google or the W3C. Built with AI assistance.*"
        ),
    }
}

def find_existing_article():
    resp = requests.get(f"{BASE}/articles/me/all", headers=HEADERS)
    resp.raise_for_status()
    for a in resp.json():
        if "webmcp" in a.get("title", "").lower():
            return a["id"]
    return None


BASE = "https://dev.to/api"
HEADERS = {"api-key": api_key}

if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        print(f"Title: {article['article']['title']}")
        print(f"Tags: {article['article']['tags']}")
        print(f"Published: {article['article']['published']}")
        print(f"Body length: {len(article['article']['body_markdown'])} chars")
        print("\n--- Preview ---")
        print(article["article"]["body_markdown"][:500] + "...")
        print("\nDry run complete. Remove --dry-run to post.")
        sys.exit(0)

    if "--publish" in sys.argv:
        article["article"]["published"] = True

    existing_id = find_existing_article()

    if existing_id:
        response = requests.put(
            f"{BASE}/articles/{existing_id}",
            headers={**HEADERS, "Content-Type": "application/json"},
            data=json.dumps(article),
        )
        action = "Updated"
    else:
        response = requests.post(
            f"{BASE}/articles",
            headers={**HEADERS, "Content-Type": "application/json"},
            data=json.dumps(article),
        )
        action = "Created"

    if response.status_code in (200, 201):
        data = response.json()
        status = "PUBLISHED" if article["article"]["published"] else "DRAFT"
        print(f"Article {action.lower()} ({status}): {data['url']}")
    else:
        print(f"ERROR {response.status_code}: {response.text}")
        sys.exit(1)
