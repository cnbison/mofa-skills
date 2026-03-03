---
name: mofa-research
description: "Deep research pipeline — dynamic parallel multi-angle search, analyze, and synthesize. Triggers: deep research, 深度研究, 深度调查, comprehensive research, research report, 研究报告"
requires_bins: []   # DOT-based pipeline; no external binaries needed
requires_env: []    # pipeline runner provides model routing
---

# mofa-research

A DOT-based deep research pipeline that **dynamically plans** N search angles via LLM, executes them **in parallel**, then analyzes and synthesizes sequentially:

```
plan_and_search ──(N dynamic workers)──→ analyze ──→ synthesize
                                          (strong)    (strong, goal gate)
```

1. **Plan** — LLM generates 4-6 search angles tailored to the query (strong model)
2. **Search** — Spawns N search agents concurrently (cheap model, web tools)
3. **Analyze** — Cross-references all search outputs, organizes by subtopic (strong model)
4. **Synthesize** — Produces a structured report with citations (strong model, goal gate)

## Usage

```
run_pipeline(pipeline="mofa-research/deep_research", input="<research topic>")
```

The pipeline file is at `~/.crew/skills/mofa-research/deep_research.dot`.

## How it works

The `plan_and_search` node uses `handler="dynamic_parallel"`:

1. The **planner** LLM call generates a JSON array of `{task, label}` objects
2. Each task becomes a synthetic Codergen worker node with the `worker_prompt` template
3. All workers run concurrently via `futures::join_all`
4. When all complete, their outputs are merged and fed to the `analyze` node
5. Fallback: if the planner fails or returns <2 tasks, 3 generic angles are used

Compared to the old static `parallel` approach (4 hardcoded angles), `dynamic_parallel`:
- Adapts the number and type of search angles to each query
- Generates cross-language angles automatically
- Can produce 4-8 angles depending on topic complexity

## Performance

With dynamic parallel search agents (~300s each):
- **Sequential** (old): ~1200s + analyze + synthesize = ~1800s
- **Dynamic parallel** (new): ~300s + analyze + synthesize = ~900s (2x overall speedup)

## Data flow between nodes

- **plan_and_search → analyze**: All N worker outputs are merged with `## Label` headers and `---` separators
- **analyze → synthesize**: The analysis is passed as-is to the synthesis node

Each worker runs an independent agent with fresh context plus the original user input.

## Customization

Copy `deep_research.dot` and edit:
- `prompt` — change the planning prompt to control how angles are generated
- `worker_prompt` — template for each worker (use `{task}` placeholder)
- `planner_model` / `model` — change which ProviderRouter keys to use
- `tools="deep_search,read_file"` — restrict which tools each worker can access
- `max_tasks="8"` — cap on number of dynamic tasks
- `timeout_secs="600"` — per-worker timeout
- Add intermediate nodes (e.g. `fact_check` between analyze and synthesize)
