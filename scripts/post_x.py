"""Post the webmcp-gen announcement thread to X/Twitter."""

import os
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

try:
    import tweepy
except ImportError:
    print("Installing tweepy...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "tweepy"])
    import tweepy

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(env_path)

api_key = os.getenv("X_API_KEY")
api_secret = os.getenv("X_API_SECRET")
access_token = os.getenv("X_ACCESS_TOKEN")
access_secret = os.getenv("X_ACCESS_SECRET")

if not all([api_key, api_secret, access_token, access_secret]):
    print("ERROR: Missing X API credentials in .env")
    sys.exit(1)

client = tweepy.Client(
    consumer_key=api_key,
    consumer_secret=api_secret,
    access_token=access_token,
    access_token_secret=access_secret,
)

tweets = [
    (
        "The WebMCP ecosystem has crawlers (site to tools) and runtime SDKs "
        "(Zod at runtime).\n\n"
        "What's missing: build-time codegen from your existing TypeScript.\n\n"
        "webmcp-gen: TS interfaces in, spec-compliant WebMCP tool definitions "
        "out. One command.\n\n"
        "npm install -g webmcp-gen"
    ),
    (
        "How it works:\n\n"
        "1. Write your API as TS interfaces\n"
        "2. Run: npx webmcp-gen --api myapp.ts\n"
        "3. Get JSON tool definitions + handler stubs\n\n"
        "Build-time, type-safe, zero runtime deps. "
        "Complements @kaborstudio's webmcp-core and @webmcp-registry/kit "
        "- different layer."
    ),
    (
        "WebMCP lets agents execute tools on live web apps. Security matters.\n\n"
        "webmcp-gen bakes in Google's own guidance:\n"
        "- requestUserInteraction() for mutating actions\n"
        "- Sanitisation for prompt injection\n"
        "- readOnlyHint annotations for safe queries\n\n"
        "Safe defaults, not afterthoughts."
    ),
    (
        "4 starter templates to get going:\n"
        "- CRUD API\n"
        "- Search/filter\n"
        "- Form handler\n"
        "- Data transformer\n\n"
        "webmcp-gen --template crud-api\n"
        "webmcp-gen --api crud-api.ts\n\n"
        "MIT licensed. PRs welcome.\n"
        "github.com/oliuntangled/webmcp-gen"
    ),
]

if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        for i, tweet in enumerate(tweets, 1):
            print(f"\n--- Tweet {i} ({len(tweet)} chars) ---")
            print(tweet)
        print("\nDry run complete. Remove --dry-run to post.")
        sys.exit(0)

    print("Posting thread to X...")
    reply_to = None
    for i, tweet in enumerate(tweets, 1):
        response = client.create_tweet(text=tweet, in_reply_to_tweet_id=reply_to)
        tweet_id = response.data["id"]
        reply_to = tweet_id
        print(f"  Tweet {i}/4 posted (id: {tweet_id})")
        if i < len(tweets):
            time.sleep(2)

    print(f"\nThread live: https://x.com/oliuntangled/status/{tweets[0] if not reply_to else reply_to}")
    print("Done.")
