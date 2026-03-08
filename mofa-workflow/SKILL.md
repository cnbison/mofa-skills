---
name: mofa-workflow
description: "Multi-agent collaboration workflow — architect, developer, reviewer, tester working as a team on complex tasks. Triggers: multi-agent, team workflow, 多智能体, 协作, agent team, code review pipeline"
requires_bins: []
requires_env: []
---

# mofa-workflow

A DOT-based multi-agent collaboration pipeline. Specialized agents (architect, developer, reviewer, tester) work together through structured handoffs to produce higher-quality output than a single agent.

```
architect ──→ developer ──→ reviewer ──→ tester
    ↑                          │
    └──────── revise ←─────────┘
```

## Usage

```
run_pipeline(pipeline="mofa-workflow/team_build", input="<task description>")
```

The pipeline file is at `~/.crew/skills/mofa-workflow/team_build.dot`.

## Agent Roles

| Role | Model | Responsibility |
|------|-------|---------------|
| **Architect** | strong | Break down task into implementation plan, define interfaces and data flow |
| **Developer** | strong | Implement the plan, write code, produce artifacts |
| **Reviewer** | strong | Review implementation for correctness, style, edge cases. Output: approve or revision request |
| **Tester** | cheap | Generate test cases, run them, report pass/fail |

## Data flow

- **architect -> developer**: Implementation plan with file list, interfaces, and constraints
- **developer -> reviewer**: Code artifacts and implementation notes
- **reviewer -> tester** (if approved): Code ready for testing
- **reviewer -> architect** (if revision needed): Revision request with specific issues
- **tester -> output**: Test report with pass/fail results

## Customization

Copy `team_build.dot` and edit:
- Add/remove roles (e.g., drop tester for simple tasks)
- Change `model` per role (use `cheap` for boilerplate, `strong` for critical thinking)
- Adjust `max_revisions` to control how many review cycles are allowed
- Add domain-specific instructions to each role's `prompt`
