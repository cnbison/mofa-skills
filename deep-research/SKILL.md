---
name: deep-research
description: Iterative exploration-based deep research with Tavily search and fallback to web scraping. Human-like browsing with depth-first link following.
requires_bins: curl
requires_env: TAVILY_API_KEY
always: false
---

# Deep Research

Human-like iterative research skill. Explores the web depth-first: search → evaluate links → dive deep → follow trails → synthesize findings.

## Trigger Phrases

- "深度研究"
- "deep research on"
- "调研一下"
- "帮我查查"
- "research report"
- "全面分析"
- "查资料"

## Architecture

```
User Query
    ↓
Entry Agent (分析意图，确定探索策略)
    ↓
┌─────────────────────────────────────────────┐
│           EXPLORATION LOOP                  │
│                                             │
│  ┌─────────────┐    ┌─────────────────┐    │
│  │ 搜索发现     │◄───┤ 新链接/新子问题   │    │
│  │             │    │ (来自页面内容)    │    │
│  │ 1. Tavily   │    └─────────────────┘    │
│  │ 2. Google   │                           │
│  │    (fetch)  │                           │
│  └──────┬──────┘                           │
│         │                                   │
│         ↓                                   │
│  ┌─────────────┐    ┌─────────────┐        │
│  │ 评估价值     │──否─┤ 跳过/低优先级  │        │
│  │ (LLM判断)   │    └─────────────┘        │
│  └──────┬──────┘                           │
│         │ 是                                │
│         ↓                                   │
│  ┌─────────────┐    ┌─────────────────┐    │
│  │ 深入探索     │───►│ web_fetch        │    │
│  │             │    │ 提取内容         │    │
│  └──────┬──────┘    └─────────────────┘    │
│         │                                   │
│         ↓                                   │
│  ┌─────────────┐                           │
│  │ 提取知识     │───► 存入 KnowledgeBase   │
│  │ (facts/     │     (facts, sources,      │
│  │  quotes)    │      contradictions)      │
│  └─────────────┘                           │
│         │                                   │
│         └───────────────────────────────────┘
│              ↑ 发现新线索，继续循环
└─────────────────────────────────────────────┘
         ↓ 满足结束条件
    Synthesize Agent
         ↓
    Final Report (带完整引用链)
```

## Search Methods

### Method 1: Tavily Search (推荐)

需要环境变量 `TAVILY_API_KEY`

```bash
# 使用 Tavily API 搜索
curl -s "https://api.tavily.com/search" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "'"$TAVILY_API_KEY"'",
    "query": "AI regulation 2026",
    "search_depth": "basic",
    "max_results": 10,
    "include_answer": false
  }'
```

### Method 2: Google via web_fetch (Fallback)

当 Tavily 不可用时，抓取 Google 搜索结果页：

```bash
# 获取 Google 搜索结果 HTML
# 注意：需要处理 anti-bot，可能需要重试
web_fetch "https://www.google.com/search?q=AI+regulation+2026&num=10"
```

然后提取链接：
```json
{
  "role": "user",
  "content": "从以下 Google 搜索结果 HTML 中提取前 10 个链接的标题和 URL:\n\n[HTML content...]\n\n输出 JSON: [{\"title\": \"...\", \"url\": \"...\"}]"
}
```

### Method 3: Direct URL (已知权威源)

直接访问已知高质量来源：

```bash
# 学术论文
web_fetch "https://arxiv.org/list/cs.AI/recent"

# 技术博客
web_fetch "https://blog.google/technology/ai/"

# Hacker News
web_fetch "https://news.ycombinator.com/"
```

## Workflow (Aggressive Recursive Exploration)

### Phase 1: Entry (意图分解 + 广度规划)

**目标**: 生成 5-8 个独立搜索角度，确保广度覆盖

```json
{
  "role": "user",
  "content": "深度分析查询，生成多角度搜索策略。\n\n查询: 'AI regulation 2026'\n\n要求:\n1. 核心主题识别\n2. 关键子问题 (5-8个，确保不同维度)\n3. 每个子问题生成 2-3 个具体搜索查询\n4. 识别潜在的'新闻线索'（事件→发展→影响→反应链条）\n\n输出格式见 templates/entry-prompt.md"
}
```

**并行启动 Sub-Agents**:

```bash
# 为每个角度启动独立 sub-agent 并行搜索
spawn "research-angle-1" "搜索角度1的具体提示"
spawn "research-angle-2" "搜索角度2的具体提示"
# ... 至少 5 个角度同时搜索
```

### Phase 2: Discovery (多源并行搜索)

**每个 Sub-Agent 执行**:

```bash
# 1. Tavily 搜索
curl -s "https://api.tavily.com/search" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "'"$TAVILY_API_KEY"'",
    "query": "角度具体查询",
    "search_depth": "advanced",
    "max_results": 10
  }'

# 2. 对同一角度，用不同关键词再次搜索（确保广度）
curl -s "https://api.tavily.com/search" ... "同义词/相关词查询"

# 3. Tavily 失败时 fallback 到 Google
web_fetch "https://www.google.com/search?q=...&num=10"
```

**Minimum Breadth Requirement**:
- 至少 5 个不同角度
- 每个角度至少 5 个不同来源
- 至少覆盖 3 种不同类型的源（新闻/学术/官方）

### Phase 3: Deep Dive (递归深入)

**核心规则**: 每发现一个重要线索 → 必须递归搜索 2-3 层

```
新闻事件发现
    ↓
Layer 1: 事件本身（发生了什么）
    ↓ 发现相关实体/人物/时间
Layer 2: 背景搜索（为什么发生、历史脉络）
    ↓ 发现影响因素
Layer 3: 影响搜索（影响范围、各方反应、后续发展）
    ↓ 可能发现新的相关事件 → 继续递归
```

**示例 - 新闻追踪模式**:

```bash
# 初始发现: "美国拟收紧AI芯片出口管制"
web_fetch "新闻页面"

# Layer 1: 事件详情
提取: 时间(3月6日)、涉及公司(NVIDIA/AMD)、具体措施

# Layer 2: 背景深挖
spawn "background-search" "搜美国AI芯片管制历史 2022-2025"
spawn "context-search" "搜 Biden administration semiconductor policy"

# Layer 3: 影响追踪
spawn "impact-search" "搜 NVIDIA stock reaction export controls"
spawn "global-search" "搜 China EU response US AI chip ban"
spawn "industry-search" "搜 AI companies alternative chips"

# Layer 4: 连锁反应（如果发现新线索）
# 如发现"中国AI芯片突破" → 继续搜中国芯片进展、中芯国际等
```

**递归触发条件**:
- 发现具体日期/事件 → 搜前后发展
- 发现公司/人物 → 搜相关背景/言论
- 发现数据/统计 → 搜来源和验证
- 发现政策/法规 → 搜全文和解读

### Phase 4: Cross-Reference (交叉验证)

对同一事实，必须从至少 2 个独立来源验证:

```bash
# 发现 Claim: "EU AI Act 2026年8月生效"
# 必须搜至少 2 个独立来源确认

web_search "EU AI Act effective date official"
web_search "EU AI Act August 2026 europa.eu"
web_search "European Commission AI Act implementation timeline"
```

### Phase 5: Evaluate (价值评估)

```json
{
  "role": "user",
  "content": "评估深度价值:\n\nURL: ...\n内容摘要: ...\n当前探索深度: Layer 3\n\n输出 JSON:\n{\n  \"relevance\": 0-1,\n  \"authority\": 0-1,\n  \"depth_potential\": 0-1,  // 是否还有更多可挖的线索\n  \"should_explore_deeper\": true/false,  // 是否继续递归\n  \"follow_up_queries\": [\"...\", \"...\"],  // 建议的下一步搜索\n  \"should_explore\": true/false\n}"
}
```

### Phase 6: Knowledge Extraction (知识提取)

从页面提取时，**必须**识别可递归线索:

```json
{
  "facts": [...],
  "sources": [...],
  "recursion_candidates": [  // 必须识别的新线索
    {
      "type": "event|person|company|data|policy",
      "entity": "具体名称",
      "suggested_queries": ["...", "..."],
      "priority": "high|medium|low"
    }
  ]
}
```

### Phase 7: Recursive Loop (强制递归)

**不满足以下条件不得停止**:

```
MINIMUM REQUIREMENTS:
✓ 至少深入 3 层递归 (Layer 1-2-3)
✓ 至少 5 个不同搜索角度
✓ 至少 15 个不同来源
✓ 至少 25 个 facts
✓ 每个重要事件都有: 背景 + 现状 + 影响 + 反应
✓ 连续 5 次递归未发现新线索（而非 3 次）
```

**递归循环代码逻辑**:

```python
while not meeting_minimum_requirements():
    # 1. 检查所有未探索的高优先级 recursion_candidates
    for candidate in kb.recursion_candidates:
        if candidate.priority == "high":
            # 启动新搜索
            results = search(candidate.suggested_queries)

            # 2. 评估是否值得继续深入
            if evaluate(results).should_explore_deeper:
                # 继续递归 (Layer N+1)
                dive_deeper(results)

    # 3. 检查是否达到最小要求
    if check_minimum_requirements():
        # 再额外探索 2 轮确保饱和
        for _ in range(2):
            extra_exploration()
        break
```

### Phase 8: Synthesize (综合报告)

```json
{
  "role": "user",
  "content": "基于收集的知识生成研究报告:\n\n[KnowledgeBase...]\n\n报告结构:\n1. Executive Summary (3-5句)\n2. Key Findings (带引用 [1], [2])\n3. Detailed Analysis (按主题组织)\n4. Contradictions & Uncertainties\n5. Sources (完整引用列表)"
}
```

## KnowledgeBase 结构

```json
{
  "query": "AI regulation 2026",
  "facts": [
    {
      "id": "f1",
      "claim": "EU AI Act fully effective August 2026",
      "confidence": "high",
      "sources": ["s1", "s2"],
      "quote": "The Act will apply from 2 August 2026..."
    }
  ],
  "sources": [
    {
      "id": "s1",
      "title": "EU AI Act Official Text",
      "url": "https://...",
      "domain": "europa.eu",
      "authority": "high",
      "date": "2024-08-01",
      "accessed": "2026-03-11"
    }
  ],
  "contradictions": [
    {
      "id": "c1",
      "claim_a": "US federal AI law passes Q2 2026",
      "source_a": "s3",
      "claim_b": "US law delayed to Q4 2026",
      "source_b": "s4",
      "resolution": "pending_verification"
    }
  ],
  "exploration_log": [
    {"action": "tavily_search", "query": "...", "results_count": 10},
    {"action": "evaluate", "url": "...", "score": 0.9},
    {"action": "explore", "url": "...", "facts_extracted": 5},
    {"action": "follow_link", "from": "...", "to": "..."}
  ]
}
```

## Configuration

见 `config.toml`，可调整：
- `max_depth_links`: 最大深入链接数
- `max_iterations`: 探索循环次数上限
- `score_threshold`: 评估通过分数
- `min_facts`: 最少收集 facts 数
- `search_method`: `tavily` | `google` | `auto`

## Tools Used

- **Tavily API**: 高质量搜索结果 (需要 `TAVILY_API_KEY`)
- `web_fetch`: 获取页面内容，或作为搜索 fallback
- `browser_navigate/click/read`: 交互式浏览
- `read_file/write_file`: KnowledgeBase 持久化
- `message`: HITL 确认矛盾或不确定时

## Best Practices

1. **优先 Tavily**: 结构化搜索结果，包含 title/url/content
2. **Google Fallback**: Tavily 失败时自动降级
3. **优先权威源**: .gov, .edu, 知名媒体优先探索
4. **追踪引用链**: 页面里的链接往往更有价值
5. **记录探索路径**: 方便回溯和验证
6. **标记不确定性**: 低 confidence 的 fact 要明确标注
7. **及时收敛**: 边际收益低时停止，避免无限探索

## Error Handling

| Scenario | Fallback |
|----------|----------|
| Tavily API 失败 | 自动降级到 Google web_fetch |
| Google 被 block | 使用直接 URL 列表 |
| 页面 fetch 失败 | 尝试 browser 工具 |
| 所有搜索失败 | 请求用户提供起始链接 |

## Output Requirements (MANDATORY)

### 必须写入文件

研究完成后，**必须**执行以下写入操作：

1. **最终报告** → `./research/{query-slug}/report.md`
```bash
write_file "./research/{query-slug}/report.md" "${report_content}"
```

2. **知识库** → `./research/{query-slug}/kb/knowledge.json`
```bash
write_file "./research/{query-slug}/kb/knowledge.json" "${knowledge_base_json}"
```

3. **探索日志** → `./research/{query-slug}/exploration_log.json`
```bash
write_file "./research/{query-slug}/exploration_log.json" "${exploration_log}"
```

### 输出规范

- **路径生成**: `query-slug = query.lower().replace(' ', '-').replace('/', '-')[:50]`
- **报告格式**: Markdown，包含完整引用
- **同时展示**: 写入文件后，给用户简要总结（3-5 个要点）
- **禁止 Emoji**: 报告和总结中不要使用任何 emoji 或 Unicode 符号，保持专业纯文本格式

### 禁止行为

[禁止] **不能只对话不写入**
[禁止] **不能把报告只存在对话上下文**
[禁止] **不能让用户手动要求才写入**

## File Structure

```
./research/
├── {query-slug}/
│   ├── kb/
│   │   ├── facts.json
│   │   ├── sources.json
│   │   └── contradictions.json
│   ├── exploration_log.json
│   └── final-report.md
└── cache/
    └── tavily-{hash}.json
```
