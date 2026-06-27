---
name: flexible-numeric-spec
description: Migrate a strict numeric DB field to a flexible text spec that supports discrete values, ranges, and a unit toggle across schema, server validation, and UI
source: auto-skill
extracted_at: '2026-06-27T11:31:44.554Z'
---

# Migrate a Strict Numeric Field to a Flexible Spec with Units

## Purpose

Replace a single numeric column in the database with a text-based specification field that can represent either a list of discrete values (`5, 10, 15`), a continuous range (`1-20`), or a single value, plus a separate unit column (e.g. `kg` / `lb`). Then update validation, seed data, CSV import, system prompts, and the UI so the rest of the app understands the richer format.

## When to Use

- A feature needs to describe equipment, dimensions, quantities, or loads where the original `real` / `number` field is too restrictive.
- Users want to enter ranges or comma-separated lists instead of just one value.
- Users need to switch units (kg/lb, cm/in, etc.) for the same underlying resource.
- The field is read by an LLM, so a human-readable spec string is preferable to normalized rows.

## Procedure

### 1. Change the Database Schema

Edit the ORM schema (e.g. Drizzle) for the table:

```typescript
// before
weight: real("weight"),

// after
weight: text("weight"),
weightUnit: text("weight_unit").default("kg").notNull(),
```

- Change the spec column to `text` so it can hold `5, 10, 15`, `1-20`, or `20`.
- Add a non-nullable unit column with a sensible default (the existing unit of the dataset).
- Leave *logged/actual values* (such as a set's recorded weight) as numeric; only the resource's *capabilities/specification* become text.

### 2. Update the Seed / Migration Script

If the project uses a raw SQL bootstrap or seed script, update the DDL:

```sql
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  weight TEXT,
  weight_unit TEXT NOT NULL DEFAULT 'kg',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

Then update default seed data to use the new shape:

```typescript
const defaultEquipment = [
  { name: "Dumbbells", category: "dumbbell", weight: "5, 10, 12, 15, 20, 25", weightUnit: "kg" },
  { name: "Cable Machine", category: "cable", weight: "5-80", weightUnit: "kg" },
  { name: "Flat Bench", category: "bench", weight: null, weightUnit: "kg" },
];
```

For CSV import, store the raw weight string instead of parsing it to a float. Also recognize a `weight_unit` column so imported files can carry kg/lb per row:

```typescript
const weightUnitIdx = columns.findIndex((c) => c === "weight_unit");

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
  const name = values[nameIdx];
  const category = values[categoryIdx];
  const weightRaw = weightIdx !== -1 ? values[weightIdx].trim() : "";
  const weight = weightRaw || null;
  const unitRaw = weightUnitIdx !== -1 ? (values[weightUnitIdx]?.trim().toLowerCase() ?? "") : "";
  const weightUnit = unitRaw === "lb" || unitRaw === "lbs" ? "lb" : "kg";

  if (!name || !category) continue;
  db.insert(equipmentTable).values({ name, category, weight, weightUnit }).run();
}
```

Comma-separated weights in the CSV must be wrapped in quotes so they stay in a single column (e.g. `"5, 10, 15"`).

### 3. Centralise Server-Side Validation

Create one regex/pattern that accepts single values, comma lists, and ranges, then force non-negative numbers:

```typescript
const WEIGHT_PATTERN = /^(\d+(\.\d+)?)(\s*[-,]\s*\d+(\.\d+)?)*$/;

let validatedWeight: string | undefined = undefined;
if (weight && weight.trim()) {
  const trimmed = weight.trim();
  if (!WEIGHT_PATTERN.test(trimmed)) {
    return { success: false, error: "Weight must be a number, comma-separated list, or range" };
  }
  const nums = trimmed.split(/[-,]/).map((n) => Number(n.trim()));
  if (nums.some((n) => n < 0)) {
    return { success: false, error: "Weight values cannot be negative" };
  }
  validatedWeight = trimmed;
}
```

Validate the unit against an allow-list:

```typescript
const unitSchema = z.enum(["kg", "lb"]);
```

### 4. Update LLM / System-Prompt Consumers

Change any code that rendered `${weight}kg` to show the new text spec and unit:

```typescript
const equipmentText = equipmentList
  .map((e) => {
    const weightInfo = e.weight ? `, ${e.weight} ${e.weightUnit ?? "kg"}` : "";
    return `- ${e.name} (${e.category}${weightInfo})`;
  })
  .join("\n");
```

### 5. Rework the UI into Side-by-Side Panes

The original single-column layout likely stacked "form, list, upload, help". Replace it with a two-column grid so the list is always visible and independently scrollable:

```tsx
<div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
  {/* left: add form + CSV upload + help */}
  <div className="flex flex-col gap-6">…</div>

  {/* right: scrollable list */}
  <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:self-start">
    <h2>Available equipment</h2>
    <ul className="mt-4 max-h-[60vh] divide-y overflow-y-auto">
      {items.map((item) => (…))}
    </ul>
  </div>
</div>
```

Key UX decisions in that layout:
- Left panes include the add form, CSV upload, and CSV format help.
- Right pane is the equipment list with `max-h-[60vh] overflow-y-auto` so it scrolls in isolation.
- `lg:sticky lg:top-6` keeps the list in view while the form is long.
- On mobile the grid collapses to a single column and the list sits below the forms.

### 6. Add the Unit Toggle Next to the Weight Input

Use segmented buttons to switch `kg` / `lb` and store the active unit in component state:

```tsx
<div className="flex items-center justify-between">
  <label htmlFor="eq-weight">Weight</label>
  <div className="flex gap-1 rounded-lg border p-0.5">
    <button type="button" onClick={() => setWeightUnit("kg")} className={…}>kg</button>
    <button type="button" onClick={() => setWeightUnit("lb")} className={…}>lb</button>
  </div>
</div>
<input
  id="eq-weight"
  type="text"
  placeholder="e.g. 5, 10, 12, 15 or 1-20"
  value={weight}
  onChange={(e) => setWeight(e.target.value)}
/>
<p className="text-xs text-zinc-500">
  Use commas for static weights or a dash for a range. Leave empty if not applicable.
</p>
```

### 7. Update CSV Examples and Upload Labels

Make the CSV documentation and upload components mention the new formats so users know comma lists and ranges are valid. Include `weight_unit` and quote comma-separated lists:

```tsx
const CSV_EXAMPLE = `name,category,weight,weight_unit
Dumbbells,free weights,"5, 10, 12, 15",kg
Adjustable Dumbbells,free weights,5-50,lb
Cable Machine,machine,5-80,kg
Pull-Up Bar,calisthenics,,`;
```

```tsx
<p>Expected columns: <code>name, category, weight, weight_unit</code>. Weight supports lists (&quot;5, 10, 15&quot;) or ranges (1-20). Unit accepts kg or lb.</p>
```

### 8. Rebuild / Reseed and Verify

Because the column type changed, delete and recreate the local SQLite database (safe in local development):

```bash
rm -f data/ai-trainer.db data/ai-trainer.db-wal data/ai-trainer.db-shm
npm run seed
npm run lint
npm run build
```

## Key Pitfalls

| Pitfall | Why It Happens | Fix |
|---------|---------------|-----|
| Old DB rows still have numeric weight | SQLite will store numbers as text, but downstream code may expect a number | Delete and re-seed when changing a column type |
| CSV import parses `5, 10` as just `5` | `parseFloat` stops at the comma | Keep CSV weight as a raw string |
| Negative values slip through | Regex alone does not enforce numeric semantics | Split by `[-,]`, cast to numbers, and check `< 0` |
| UI list pushes the add form off screen | Single-column stacking becomes unwieldy | Use a side-by-side grid with an independently scrollable list |
| LLM prompt says `undefinedkg` | The old renderer assumed a numeric column | Read both `weight` and `weightUnit`, and guard for null |

## Output Format

- Schema change: text spec column + unit column.
- Server validation: pattern + unit allow-list + non-negative check.
- UI: side-by-side layout with independently scrollable list, unit toggle, and hint text for lists/ranges.
- Updated seed data, CSV import, and LLM prompt rendering.
