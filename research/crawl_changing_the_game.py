import json
import re
import time
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

BASE = "https://changingthegameproject.com"
BLOG_URL = f"{BASE}/blog/"
USER_AGENT = "LaxHornetResearchBot/1.0 (+local research synthesis)"

DISCOVERY_URLS = [
    f"{BASE}/robots.txt",
    f"{BASE}/feed/",
    f"{BASE}/wp-json/wp/v2/posts?per_page=100&page=1",
    f"{BASE}/wp-json/wp/v2/posts?per_page=100&page=2",
    f"{BASE}/sitemap_index.xml",
    f"{BASE}/post-sitemap.xml",
    BLOG_URL,
]


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.title = ""
        self._in_title = False
        self.text_chunks = []
        self._skip = 0
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"script", "style", "noscript"}:
            self._skip += 1
        if tag == "title":
            self._in_title = True
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "meta":
            name = attrs.get("name") or attrs.get("property")
            content = attrs.get("content")
            if name and content:
                self.meta[name.lower()] = content

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self._skip:
            self._skip -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._skip:
            return
        cleaned = " ".join(data.split())
        if not cleaned:
            return
        if self._in_title:
            self.title += cleaned
        self.text_chunks.append(cleaned)


def safe_name(url: str) -> str:
    parsed = urlparse(url)
    slug = parsed.path.strip("/").replace("/", "__") or "home"
    if parsed.query:
        slug += "__" + re.sub(r"[^a-zA-Z0-9]+", "_", parsed.query).strip("_")
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", slug)[:160]


def fetch(url: str, timeout=25):
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=timeout) as response:
            body = response.read()
            content_type = response.headers.get("content-type", "")
            return {
                "url": url,
                "status": response.status,
                "content_type": content_type,
                "body": body.decode("utf-8", errors="replace"),
                "error": "",
            }
    except Exception as exc:
        return {"url": url, "status": None, "content_type": "", "body": "", "error": repr(exc)}


def parse_html(url: str, html: str):
    parser = LinkParser()
    parser.feed(html)
    links = []
    for href in parser.links:
        full = urljoin(url, href)
        if urlparse(full).netloc.endswith("changingthegameproject.com"):
            full = full.split("#")[0]
            links.append(full)
    text = unescape("\n".join(parser.text_chunks))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return {
        "title": unescape(parser.title).replace(" - Changing the Game Project", "").strip(),
        "links": sorted(set(links)),
        "text": text,
        "meta": parser.meta,
    }


def discover_urls():
    discovery = []
    candidate_urls = set()
    for url in DISCOVERY_URLS:
        result = fetch(url)
        discovery.append({k: v for k, v in result.items() if k != "body"})
        (RAW_DIR / f"discovery__{safe_name(url)}.txt").write_text(result["body"], encoding="utf-8")
        body = result["body"]
        if result["error"]:
            continue
        if "json" in result["content_type"] or body.lstrip().startswith("["):
            try:
                data = json.loads(body)
                if isinstance(data, list):
                    for item in data:
                        link = item.get("link")
                        if link:
                            candidate_urls.add(link)
            except Exception:
                pass
        if "<rss" in body[:500].lower() or "<feed" in body[:500].lower() or "<urlset" in body[:500].lower() or "<sitemapindex" in body[:500].lower():
            for match in re.findall(r"<loc>(.*?)</loc>", body, flags=re.I | re.S):
                candidate_urls.add(unescape(match.strip()))
            for match in re.findall(r"<link>(.*?)</link>", body, flags=re.I | re.S):
                candidate_urls.add(unescape(match.strip()))
        if "html" in result["content_type"] or "<html" in body[:1000].lower():
            parsed = parse_html(url, body)
            candidate_urls.update(parsed["links"])
    return discovery, candidate_urls


ARTICLE_HINTS = [
    "coach",
    "coaching",
    "athlete",
    "youth",
    "sport",
    "sports",
    "parent",
    "team",
    "teammate",
    "talent",
    "culture",
    "confidence",
    "mistake",
    "practice",
    "leader",
    "communication",
    "compete",
    "defeat",
    "winning",
    "quit",
    "play",
    "game",
]


def looks_like_article(url: str):
    parsed = urlparse(url)
    if parsed.netloc != "changingthegameproject.com":
        return False
    path = parsed.path.strip("/")
    if not path or path in {"blog", "about", "contact", "privacy-policy"}:
        return False
    if any(path.startswith(prefix) for prefix in ["category/", "tag/", "author/", "page/", "wp-", "wp-content"]):
        return False
    if path.endswith((".jpg", ".png", ".gif", ".webp", ".pdf", ".xml")):
        return False
    return True


def article_score(record):
    text = (record.get("title", "") + " " + record.get("text", "")[:5000]).lower()
    score = 0
    for hint in ARTICLE_HINTS:
        if hint in text:
            score += 1
    topic_terms = [
        "decision",
        "development",
        "mistake",
        "confidence",
        "culture",
        "leadership",
        "communication",
        "effort",
        "compet",
        "practice",
        "talent",
        "long term",
        "intrinsic",
        "ownership",
        "enjoyment",
        "serve",
        "coach",
    ]
    for term in topic_terms:
        score += text.count(term)
    return score


def main():
    discovery, candidates = discover_urls()
    blog = fetch(BLOG_URL)
    if blog["body"]:
        parsed = parse_html(BLOG_URL, blog["body"])
        candidates.update(parsed["links"])

    candidates = {url for url in candidates if looks_like_article(url)}

    fetched = []
    inaccessible = []
    for url in sorted(candidates):
        result = fetch(url)
        base_record = {k: v for k, v in result.items() if k != "body"}
        if result["error"] or not result["body"]:
            inaccessible.append(base_record)
            continue
        parsed = parse_html(url, result["body"])
        text = parsed["text"]
        if len(text) < 1200:
            inaccessible.append({**base_record, "reason": "too little article text"})
            continue
        raw_path = RAW_DIR / f"{safe_name(url)}.txt"
        raw_path.write_text(text, encoding="utf-8")
        fetched.append(
            {
                "url": url,
                "status": result["status"],
                "content_type": result["content_type"],
                "title": parsed["meta"].get("og:title") or parsed["title"],
                "description": parsed["meta"].get("og:description", ""),
                "raw_text_path": str(raw_path.relative_to(ROOT)),
                "text_length": len(text),
                "score": article_score(parsed),
                "links": parsed["links"][:40],
            }
        )
        time.sleep(0.2)

    fetched.sort(key=lambda item: item["score"], reverse=True)
    output = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "blog_url": BLOG_URL,
        "discovery": discovery,
        "candidate_count": len(candidates),
        "accessible_count": len(fetched),
        "inaccessible": inaccessible,
        "articles": fetched,
    }
    (ROOT / "crawl-results.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps({k: output[k] for k in ["candidate_count", "accessible_count"]}, indent=2))
    print("Top articles:")
    for article in fetched[:25]:
        print(f"- {article['score']:>3} {article['title']} | {article['url']}")


if __name__ == "__main__":
    main()
