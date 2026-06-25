---
name: nextjs-scaffold-existing-dir
description: Scaffold a Next.js app into an existing directory whose name violates npm's lowercase naming restriction
source: auto-skill
extracted_at: '2026-06-25T15:40:47.701Z'
---

# Scaffold Next.js into an Existing Directory with Invalid npm Name

## Problem

`npx create-next-app@latest .` fails when the current directory name contains uppercase letters (e.g., `Local-Personal-Ai-Trainer`), because npm enforces lowercase package names:

```
Could not create a project called "Local-Personal-Ai-Trainer" because of npm naming restrictions:
    * name can no longer contain capital letters
```

## Solution

1. **Scaffold into a temp directory** with a valid lowercase name:
   ```bash
   cd /tmp && npx create-next-app@latest ai-trainer-scaffold --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm
   ```

2. **Copy files into the target directory**, excluding `.git` and any existing project docs you want to keep:
   ```bash
   cd /tmp/ai-trainer-scaffold
   cp -r --no-clobber node_modules package.json package-lock.json eslint.config.mjs next.config.ts next-env.d.ts postcss.config.mjs public src tsconfig.json /path/to/your/project/
   ```

3. **Fix the package name** in `package.json` to a valid lowercase name:
   ```json
   { "name": "ai-trainer" }
   ```

4. **Clean up** the temp directory:
   ```bash
   rm -rf /tmp/ai-trainer-scaffold
   ```

## Key Flags for create-next-app

| Flag | Purpose |
|------|---------|
| `--typescript` | TypeScript setup |
| `--tailwind` | Tailwind CSS |
| `--app` | App Router (not Pages Router) |
| `--eslint` | ESLint config |
| `--src-dir` | Use `src/` directory layout |
| `--import-alias "@/*"` | Path alias pointing to `./src/*` |
| `--use-npm` | Use npm (not yarn/pnpm) |

## Notes

- Use `--no-clobber` with `cp` to avoid overwriting existing files (like your own `.gitignore`, markdown docs, etc.)
- Always verify the build passes (`npm run build`) after copying files into the target directory
- The `--no-clobber` flag preserves your existing `.git` directory, README, and any other project-specific files
