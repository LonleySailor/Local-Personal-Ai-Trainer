"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addEquipment, deleteEquipment, getEquipment } from "@/app/api/equipment/actions";
import ExerciseUpload from "./ExerciseUpload";

type EquipmentList = Awaited<ReturnType<typeof getEquipment>>;

const CSV_EXAMPLE = `name,category,weight,weight_unit
Dumbbells,free weights,"5, 10, 12, 15",kg
Kettlebells,free weights,"12, 16, 24",kg
Adjustable Dumbbells,free weights,5-50,lb
Cable Machine,machine,5-80,kg
Pull-Up Bar,calisthenics,,`;

export default function EquipmentManager({
  initialEquipment,
}: {
  initialEquipment: EquipmentList;
}) {
  const [items, setItems] = useState<EquipmentList>(initialEquipment);
  const [isPending, startTransition] = useTransition();
  const [formStatus, setFormStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");

  async function refresh() {
    const latest = await getEquipment();
    setItems(latest);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormStatus({ type: "idle" });

    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", category);
    formData.append("weight", weight);
    formData.append("weightUnit", weightUnit);

    const result = await addEquipment(formData);

    if (!result.success) {
      setFormStatus({ type: "error", message: result.error });
      return;
    }

    await refresh();
    setName("");
    setCategory("");
    setWeight("");
    setFormStatus({ type: "success", message: "Equipment added" });
  }

  async function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteEquipment(id);
      if (result.success) {
        await refresh();
      }
    });
  }

  return (
    <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
      {/* Left column: Add form + CSV upload + CSV format */}
      <div className="flex flex-col gap-6">
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 className="text-xl font-semibold">Add equipment</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="eq-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="eq-name"
                type="text"
                required
                placeholder="e.g. Dumbbells"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="eq-category" className="text-sm font-medium">
                Category
              </label>
              <input
                id="eq-category"
                type="text"
                required
                placeholder="e.g. free weights"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="eq-weight" className="text-sm font-medium">
                Weight
              </label>
              <div className="flex gap-1 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setWeightUnit("kg")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    weightUnit === "kg"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  }`}
                >
                  kg
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit("lb")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    weightUnit === "lb"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  }`}
                >
                  lb
                </button>
              </div>
            </div>
            <input
              id="eq-weight"
              type="text"
              placeholder="e.g. 5, 10, 12, 15 or 1-20"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="text-xs text-zinc-500">
              Use commas for static weights (5, 10, 15) or a dash for a range (1-20). Leave empty if not applicable.
            </p>
          </div>

          {formStatus.type !== "idle" && formStatus.message && (
            <p
              className={`mt-4 text-sm ${
                formStatus.type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {formStatus.message}
            </p>
          )}

          <button
            type="submit"
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Add equipment
          </button>
        </form>

        <ExerciseUpload onUpload={refresh} />

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xl font-semibold">CSV import format</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your CSV must contain <code>name</code> and{" "}
            <code>category</code> columns. The <code>weight</code> column is
            optional and supports lists (<code>&quot;5, 10, 15&quot;</code>) or
            ranges (<code>1-20</code>). Use <code>weight_unit</code> to specify{" "}
            <code>kg</code> or <code>lb</code> (defaults to kg).
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {CSV_EXAMPLE}
          </pre>
        </div>
      </div>

      {/* Right column: Scrollable equipment list */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Available equipment</h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No equipment yet.</p>
        ) : (
          <ul
            className="mt-4 max-h-[calc(100vh-12rem)] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800 lg:max-h-[60vh]"
          >
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-zinc-500">
                    {item.category}
                    {item.weight ? ` • ${item.weight} ${item.weightUnit ?? "kg"}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
