---
name: mofa-agent-memory-deck
description: Visualizes an agent's internal thought process, reasoning, and memory observations into a professional slide presentation.
---

# MoFA Agent Memory Deck

This skill ingests an agent's memory logs—thoughts, decisions, and system observations—and synthesizes them into an engaging PowerPoint (`.pptx`) presentation. It bridges backend memory systems (like `mofa-memory`) with human-readable visual reporting, creating transparent, auditable slides of an agent's execution history.

## Trigger Phrases

Activate this skill when user says:
- "Create a memory presentation"
- "Audit the agent's thought process"
- "Generate a slide deck from the agent trace"
- "Show me what the agent did visually"
- "Memory to Slides"

## Usage (CLI Examples)

```bash
# Generate a comprehensive presentation deck from an agent memory trace
mofa slides --style memory-review --input agent_memory_trace.json --out memory_audit.pptx
```

## Examples

The skill expects a raw JSON payload describing the agent's memory execution trace over a specific session. You can find a sample payload in `examples/mock_agent_trace.json`:

```text
{
  "agent_id": "Research-Agent-02",
  "task": "Analyze distributed consensus algorithms for agents",
  "traces": [
    { "timestamp": "2026-03-16T10:00:00Z", "type": "Observation", "content": "Found 12 research papers on Raft networks." },
    { "timestamp": "2026-03-16T10:05:00Z", "type": "Decision", "content": "Filtered out papers older than 2024 to ensure relevancy." }
  ]
}
```

This JSON payload is passed directly to the Gemini engine as input data. The chosen style template acts as a prefix instructing the model on how to organize the slides (e.g., Executive Summary, Key Decisions, Future Context) before passing the results to the standard `mofa slides` backend `pptxgenjs`/Rust generator.

## Features

- **Observatory Analytics**: Brings "glass-box" visibility to MoFA swarms by turning raw memory JSON into client-ready presentations.
- **Auditable Context**: Perfect for analyzing how an agent reached a specific decision during a complex workflow.
- **Synergy**: Serves as the visual frontend companion to backend memory storage paradigms like SQLite vector databases.
