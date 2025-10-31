import { planner } from "../agents/planner.js";
import { store } from "../store/kv.js";
import { TaskContract } from "../schemas/taskContract.js";

export async function planTask(input: { goal: string; context?: string }) {
  if (!input?.goal) throw new Error("Missing goal");
  const contract = await planner(input.goal, input.context);
  const parsed = TaskContract.parse(contract);
  await store.save("plans", parsed.id, parsed);
  return parsed;
}
