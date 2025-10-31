import { logger } from "../observability/logger.js";
import { getEvidenceByPointer } from "./evidenceStore.js";
import { parsePointer } from "./pointer.js";

export interface PointerValidationResult {
  ok: boolean;
  reason?: string;
  pointer: string;
  expectedVersion?: string;
  actualVersion?: string;
}

export async function validatePointer(pointer: string): Promise<PointerValidationResult> {
  try {
    const parsed = parsePointer(pointer);
    if (!parsed.version) {
      return {
        ok: false,
        reason: "MISSING_VERSION",
        pointer,
        expectedVersion: undefined,
        actualVersion: undefined
      };
    }
    const record = await getEvidenceByPointer(pointer);
    if (!record) {
      return {
        ok: false,
        reason: "NOT_FOUND",
        pointer,
        expectedVersion: parsed.version
      };
    }
    if (record.hash !== parsed.version) {
      return {
        ok: false,
        reason: "VERSION_MISMATCH",
        pointer,
        expectedVersion: record.hash,
        actualVersion: parsed.version
      };
    }
    return {
      ok: true,
      pointer,
      expectedVersion: record.hash,
      actualVersion: parsed.version
    };
  } catch (error) {
    logger.warn({
      msg: "pointer_validate_parse_error",
      pointer,
      error: (error as Error).message
    });
    return {
      ok: false,
      reason: "PARSE_ERROR",
      pointer
    };
  }
}
