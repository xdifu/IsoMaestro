import { store } from "../store/kv.js";
import { reflector } from "../agents/reflector.js";
import { RunResult } from "../schemas/runResult.js";

export async function reflectPipeline(input: { runIds: string[] }) {
  const runs = await Promise.all((input?.runIds ?? []).map(id => store.get("runs", id)));
  runs.forEach(r => RunResult.parse(r));
  return reflector(runs);
}
