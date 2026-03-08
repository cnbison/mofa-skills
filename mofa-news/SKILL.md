---
name: mofa-news
description: "News digest — fetch headlines from multiple sources, deep-read top articles, synthesize a structured briefing. Triggers: news, news digest, 新闻, 新闻简报, daily briefing, what's happening, 今日要闻"
requires_bins: [curl]
requires_env: []
---

# mofa-news

Aggregates news from multiple sources (Google News RSS, Hacker News API, Yahoo News), deep-fetches top articles for full content, and produces a structured digest.

## Categories

| Category | Sources | Deep-fetch limit |
|----------|---------|-----------------|
| politics | Google News, Yahoo News | 3 |
| world | Google News, Yahoo News | 3 |
| business | Google News, Yahoo News | 3 |
| technology | Google News, Hacker News, Substack, Medium, Yahoo News | 10 |
| science | Google News, Yahoo News | 3 |
| entertainment | Google News, Yahoo News | 2 |
| health | Google News, Yahoo News | 2 |
| sports | Google News, Yahoo News | 2 |

## Usage

Basic news digest (defaults to technology + world):

```
Fetch today's tech news and give me a briefing.
```

Specific category:

```
Give me a news digest on politics and business.
```

Full daily briefing:

```
Generate a comprehensive daily news briefing across all categories.
```

## How it works

1. **Discover** — Fetch RSS feeds and API endpoints for selected categories
2. **Rank** — Deduplicate by title similarity, rank by source credibility and recency
3. **Deep-fetch** — For top N articles per category, fetch full page content via `web_fetch`
4. **Synthesize** — LLM produces a structured digest with key takeaways per category

## RSS Sources

### Google News

```bash
curl -s "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en"
```

### Hacker News

```bash
curl -s "https://hacker-news.firebaseio.com/v0/topstories.json" | jq '.[0:30]'
```

Per-story detail: `https://hacker-news.firebaseio.com/v0/item/{id}.json`

### Yahoo News

Fetch HTML and extract headlines:

```bash
curl -s "https://news.yahoo.com/technology/"
```

## Output format

```markdown
# Daily News Digest — YYYY-MM-DD

## Technology
- **Headline 1** — 2-sentence summary. [Source](url)
- **Headline 2** — 2-sentence summary. [Source](url)
Key takeaway: ...

## World
...
```

## Integration with mofa-research

For deeper analysis on a specific news story, pipe a headline into mofa-research:

```
run_pipeline(pipeline="mofa-research/deep_research", input="<headline from news digest>")
```
