import { strict as assert } from "node:assert";
import { encodePointer, parsePointer } from "../../src/rag/pointer.js";
assert.doesNotThrow(() => {
  const id = encodePointer("c","d","f","h");
  const p = parsePointer(id);
  assert.equal(p.collection, "c");
});
