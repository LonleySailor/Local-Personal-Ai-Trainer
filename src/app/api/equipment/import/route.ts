import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { equipment } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must contain a header row and at least one data row" },
        { status: 400 }
      );
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIndex = headers.indexOf("name");
    const categoryIndex = headers.indexOf("category");
    const weightIndex = headers.indexOf("weight");
    const weightUnitIndex = headers.indexOf("weight_unit");

    if (nameIndex === -1 || categoryIndex === -1) {
      return NextResponse.json(
        { error: "CSV must contain 'name' and 'category' columns" },
        { status: 400 }
      );
    }

    const rows = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const weightRaw = weightIndex >= 0 ? cols[weightIndex].trim() : "";
      const unitRaw =
        weightUnitIndex >= 0 ? cols[weightUnitIndex]?.trim().toLowerCase() : "";

      return {
        name: cols[nameIndex]?.trim() ?? "",
        category: cols[categoryIndex]?.trim() ?? "",
        weight: weightRaw || undefined,
        weightUnit:
          unitRaw === "lb" || unitRaw === "lbs" ? "lb" : "kg",
      };
    });

    const validRows = rows.filter((row) => row.name && row.category);
    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "No valid equipment rows found in CSV" },
        { status: 400 }
      );
    }

    let added = 0;
    for (const row of validRows) {
      const existing = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(eq(equipment.name, row.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(equipment).values(row);
        added++;
      }
    }

    return NextResponse.json({
      success: true,
      parsed: validRows.length,
      added,
    });
  } catch (error) {
    console.error("Equipment import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (inQuotes) {
      if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
