const used = new Set<string>();
export const usedCapsules = {
  async ensureUnusedOrThrow(id: string) {
    if (used.has(id)) throw new Error("CAPSULE_USED");
  },
  async markUsed(id: string) { used.add(id); }
};
