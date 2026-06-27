"use server";

import { db } from "@/db/client";
import { equipment } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const WEIGHT_PATTERN = /^(\d+(\.\d+)?)(\s*[-,]\s*\d+(\.\d+)?)*$/;

const addEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  weight: z.string().optional(),
  weightUnit: z.enum(["kg", "lb"]).optional(),
});

export async function addEquipment(formData: FormData) {
  const parsed = addEquipmentSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    weight: formData.get("weight"),
    weightUnit: formData.get("weightUnit"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const { name, category, weight, weightUnit } = parsed.data;

  let validatedWeight: string | undefined = undefined;
  if (weight && weight.trim()) {
    const trimmed = weight.trim();
    if (!WEIGHT_PATTERN.test(trimmed)) {
      return {
        success: false,
        error: "Weight must be a number, comma-separated list (e.g. 5, 10, 15), or range (e.g. 1-20)",
      };
    }

    const nums = trimmed.split(/[-,]/).map((n) => Number(n.trim()));
    if (nums.some((n) => n < 0)) {
      return { success: false, error: "Weight values cannot be negative" };
    }

    validatedWeight = trimmed;
  }

  try {
    const existing = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.name, name))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: `Equipment "${name}" already exists` };
    }

    await db.insert(equipment).values({
      name,
      category,
      weight: validatedWeight,
      weightUnit: weightUnit ?? "kg",
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add equipment",
    };
  }
}

export async function deleteEquipment(id: number) {
  try {
    await db.delete(equipment).where(eq(equipment.id, id));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete equipment",
    };
  }
}

export async function getEquipment() {
  return db.select().from(equipment).orderBy(equipment.name);
}
