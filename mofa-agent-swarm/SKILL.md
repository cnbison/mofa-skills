---
name: mofa-agent-swarm
description: A high-performance Rust orchestrator for multi-agent swarm metadata management via SQLite state persistence.
---

# `mofa-agent-swarm` (Agent Coordination Skill)

This skill provides multi-agent swarm metadata management for the MoFA ecosystem using Rust. It focuses on persisting agent topology, state, and task queues in SQLite so that higher-level orchestrators can perform routing, spawning, and task delegation on top of stable, queryable state.

## Capabilities

- **State Persistence:** Preserves agent identities, roles, concurrent task limits, and pending task queues in a robust `rusqlite` layer.
- **Async-Oriented Design:** Built on `tokio` and designed to integrate with async runtimes. Task metadata is stored for external executors to route and execute; the skill itself manages state—not task execution.
- **Dynamic Provisioning:** Records metadata for specialized sub-agents with designated roles (`researcher`, `coder`, `reviewer`) that are created and managed by the surrounding orchestrator.
- **FK-enforced Consistency:** SQLite foreign keys (`PRAGMA foreign_keys = ON`) ensure cascading cleanup of tasks when an agent is shut down.
- **Priority-based Task Queue:** Tasks are ranked 1–10 (default 5) and fetched in priority order by consumers.

## Usage Examples

Spawn a new sub-agent:

```bash
echo '{"role": "researcher", "system_prompt": "You are a senior analyst. Analyze reports and extract conclusions.", "max_concurrent_tasks": 3}' | mofa-agent-swarm spawn_agent
```

Push a task payload to the agent via UUID:

```bash
echo '{"agent_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", "task_payload": "Summarize user demographics.", "priority": 8}' | mofa-agent-swarm send_task
```

Monitor the swarm:

```bash
echo '{}' | mofa-agent-swarm monitor_swarm
```
