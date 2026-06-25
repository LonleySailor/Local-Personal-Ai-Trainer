---
name: generate-qwen-md
description: Analyze a project directory and produce a comprehensive QWEN.md context file for future AI interactions
source: auto-skill
extracted_at: '2026-06-25T16:01:45.034Z'
---

# Generate a Comprehensive QWEN.md from Project Analysis

## Purpose

Produce a well-structured `QWEN.md` file at the project root that captures the project's purpose, tech stack, build/run commands, architecture, conventions, and current status. Future AI interactions can use this file as condensed context instead of re-exploring the codebase.

## When to Use

- A project lacks a `QWEN.md` or the existing one is stale/empty.
- You need to onboard a future agent to a codebase quickly.
- The project has planning documents (`README.md`, PRDs, implementation plans) that should be synthesized.

## Procedure

### 1. Initial Exploration

Start with a high-level view:

```bash
ls -la /path/to/project
```

Identify the project type:
- **Code project:** `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.
- **Non-code project:** documentation, notes, research, assets.

Read the README if it exists. If not, note that it's missing.

### 2. Iterative Deep Dive (up to ~10 files)

Select the most informative files based on project type:

**For Node.js/Next.js projects:**
- `package.json` — dependencies, scripts, tech stack
- `tsconfig.json` — strict mode, paths
- `next.config.*` — framework config
- `tailwind.config.*` / `postcss.config.*` — styling setup
- `.env.local.example` — environment variables
- `src/app/layout.tsx` / `src/app/page.tsx` — entry points
- Planning docs: PRD, `implementation-tasks.md`, architecture docs

**For other code projects:**
- Main config/manifest file
- Main source entry point
- Test config
- CI/build files

Read files one by one. Let each discovery guide the next choice.

### 3. Synthesize the QWEN.md

Write the file in this order:

1. **Project Overview**
   - What the project does.
   - Core technologies and architecture.
   - Key design decisions/constraints.

2. **Building and Running**
   - Install command.
   - Dev command.
   - Build/test/lint commands (from `package.json` scripts, Makefile, etc.).
   - Environment setup (copy `.env.local.example`, prerequisites).

3. **Project Structure**
   - Directory tree of important folders/files.
   - One-line purpose for each key directory.

4. **Architecture / Data Flow**
   - How major components interact.
   - Database schema summary (if applicable).
   - External dependencies/services.

5. **Implementation Status**
   - Current phase/task.
   - What has been completed and what remains.

6. **Key Conventions / Notes**
   - Coding style, testing approach, safety rules, post-MVP roadmap.

### 4. Verification

- Ensure the file is well-formatted Markdown.
- Run any available build/test command to confirm the project still works after exploration (do not modify code unless asked).
- If the project has a stale `QWEN.md`, compare your new version against it and preserve anything still accurate.

## Output Format

```markdown
# Project Name — Project Context

## Overview
...

## Tech Stack
| Layer | Technology |
|-------|-----------|
...

## Building & Running
```bash
...
```

## Environment Variables
...

## Project Structure
...

## Architecture
...

## Implementation Status
...

## Key Design Decisions
...

## Post-MVP / Future Work
...
```

## Tips

- Keep the overview concise but complete enough that a new agent understands the project's "why."
- Include concrete commands, not just descriptions.
- If a README is missing, note it in the QWEN.md or create one if explicitly asked.
- Use tables for tech stacks and environment variables — they're easy to scan.
- Update `QWEN.md` when significant architecture or dependency changes occur.
