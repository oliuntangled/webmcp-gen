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
            "Chrome 149 just shipped WebMCP — a browser-native API that lets web pages "
            "expose structured tools to AI agents via `navigator.modelContext`. It's in "
            "origin trial now, and if you're building for it, you'll notice there's no "
            "codegen tooling yet.\n\n"
            "**webmcp-gen** fills that gap. Write your API as TypeScript interfaces, run "
            "one command, get spec-compliant WebMCP tool definitions + handler stubs with "
            "security best practices baked in.\n\n"
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
            "**GitHub:** [oliuntangled/webmcp-gen](https://github.com/oliuntangled/webmcp-gen)\n"
            "**npm:** [webmcp-gen](https://www.npmjs.com/package/webmcp-gen)\n\n"
            "---\n\n"
            "*Not affiliated with or endorsed by Google or the W3C. Built with AI assistance.*"
        ),
    }
}

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

    response = requests.post(
        "https://dev.to/api/articles",
        headers={"api-key": api_key, "Content-Type": "application/json"},
        data=json.dumps(article),
    )

    if response.status_code == 201:
        data = response.json()
        status = "PUBLISHED" if article["article"]["published"] else "DRAFT"
        print(f"Article created ({status}): {data['url']}")
    else:
        print(f"ERROR {response.status_code}: {response.text}")
        sys.exit(1)
