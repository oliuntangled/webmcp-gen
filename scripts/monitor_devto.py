"""Monitor DEV.to comments on webmcp-gen articles and draft responses."""

import os
import sys
import json
from pathlib import Path

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

try:
    import requests
except ImportError:
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

HEADERS = {"api-key": api_key}
BASE = "https://dev.to/api"


def get_my_articles():
    resp = requests.get(f"{BASE}/articles/me/all", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def get_comments(article_id):
    resp = requests.get(f"{BASE}/comments", params={"a_id": article_id})
    resp.raise_for_status()
    return resp.json()


def post_comment(article_id, body):
    resp = requests.post(
        f"{BASE}/comments",
        headers={**HEADERS, "Content-Type": "application/json"},
        data=json.dumps({"comment": {"article_id": article_id, "body_markdown": body}}),
    )
    resp.raise_for_status()
    return resp.json()


if __name__ == "__main__":
    print("Fetching your DEV.to articles...\n")
    articles = get_my_articles()

    webmcp_articles = [a for a in articles if "webmcp" in a.get("title", "").lower()]

    if not webmcp_articles:
        print("No webmcp articles found. Has the article been published?")
        print(f"Total articles found: {len(articles)}")
        for a in articles[:5]:
            print(f"  - {a['title']} (id: {a['id']}, published: {a['published_at']})")
        sys.exit(0)

    for article in webmcp_articles:
        print(f"Article: {article['title']}")
        print(f"  URL: {article['url']}")
        print(f"  Published: {article['published_at'] or 'DRAFT'}")
        print(f"  Reactions: {article.get('positive_reactions_count', 0)}")
        print(f"  Page views: {article.get('page_views_count', 0)}")
        print()

        comments = get_comments(article["id"])
        if not comments:
            print("  No comments yet.\n")
            continue

        print(f"  {len(comments)} comment(s):\n")
        for c in comments:
            user = c.get("user", {}).get("username", "unknown")
            body = c.get("body_html", c.get("body_markdown", ""))
            created = c.get("created_at", "")
            comment_id = c.get("id_code", "")
            children = c.get("children", [])

            print(f"  [{created}] @{user} (id: {comment_id}):")
            print(f"    {body[:200]}{'...' if len(body) > 200 else ''}")

            if children:
                for child in children:
                    child_user = child.get("user", {}).get("username", "unknown")
                    child_body = child.get("body_html", child.get("body_markdown", ""))
                    print(f"      reply by @{child_user}: {child_body[:150]}")

            print()

    if "--reply" in sys.argv:
        article_id = webmcp_articles[0]["id"]
        reply_text = input("Enter reply text: ")
        result = post_comment(article_id, reply_text)
        print(f"Comment posted: {result.get('url', 'ok')}")
