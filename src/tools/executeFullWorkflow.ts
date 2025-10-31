import { planTask } from "./planTask.js";
import { compileCapsule } from "./compileCapsule.js";
import { runCapsule } from "./runCapsule.js";
import { reflectPipeline } from "./reflectPipeline.js";

/**
 * execute_full_workflow: Automatic end-to-end orchestration
 * 
 * This tool automatically chains all 4 pipeline stages:
 * 1. planTask - generates task plan from goal
 * 2. compileCapsule - compiles plan into executable capsule
 * 3. runCapsule - executes capsule in sandbox
 * 4. reflectPipeline - analyzes and reflects on results
 * 
 * Output automatically flows from one stage to the next.
 * No external orchestration needed - fully autonomous.
 */

export async function executeFullWorkflow(input: {
  goal: string;
  context?: string;
}) {
  if (!input?.goal) throw new Error("Missing goal");

  const results = {
    stages: [] as Array<{
      name: string;
      status: "success" | "failed";
      id?: string;
      duration: number;
      error?: string;
    }>,
    finalResult: null as any,
    totalDuration: 0
  };

  const startTime = Date.now();

  try {
    // ============================================================
    // STAGE 1: Plan Task
    // ============================================================
    let stageStart = Date.now();
    const plan = await planTask({
      goal: input.goal,
      context: input.context
    });
    const planDuration = Date.now() - stageStart;

    results.stages.push({
      name: "plan_task",
      status: "success",
      id: plan.id,
      duration: planDuration
    });

    // ============================================================
    // STAGE 2: Compile Capsule
    // ============================================================
    stageStart = Date.now();
    const capsule = await compileCapsule({
      contract: plan
    });
    const compileDuration = Date.now() - stageStart;

    results.stages.push({
      name: "compile_capsule",
      status: "success",
      id: capsule.id,
      duration: compileDuration
    });

    // ============================================================
    // STAGE 3: Run Capsule
    // ============================================================
    stageStart = Date.now();
    const runResult = await runCapsule({
      capsule: capsule
    });
    const runDuration = Date.now() - stageStart;

    results.stages.push({
      name: "run_capsule",
      status: "success",
      id: runResult.id,
      duration: runDuration
    });

    // ============================================================
    // STAGE 4: Reflect Pipeline
    // ============================================================
    stageStart = Date.now();
    const reflection = await reflectPipeline({
      runIds: [runResult.id]
    });
    const reflectDuration = Date.now() - stageStart;

    results.stages.push({
      name: "reflect_pipeline",
      status: "success",
      duration: reflectDuration
    });

    // ============================================================
    // Final Result
    // ============================================================
    results.finalResult = {
      planId: plan.id,
      capsuleId: capsule.id,
      runId: runResult.id,
      output: runResult.output,
      citations: runResult.citations,
      reflection: {
        severity: reflection.severity,
        conflicts: reflection.conflicts.length,
        optimizations: reflection.optimizations.length
      }
    };

    results.totalDuration = Date.now() - startTime;

    return results;

  } catch (error) {
    const stageName = results.stages.length === 0 ? "plan_task"
                    : results.stages.length === 1 ? "compile_capsule"
                    : results.stages.length === 2 ? "run_capsule"
                    : "reflect_pipeline";

    results.stages.push({
      name: stageName,
      status: "failed",
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    });

    results.totalDuration = Date.now() - startTime;

    throw {
      error: "Workflow execution failed",
      results,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
