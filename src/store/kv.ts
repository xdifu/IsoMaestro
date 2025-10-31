const buckets: Record<string, Map<string, any>> = {};
export const store = {
  async save(bucket: string, id: string, val: any) {
    if (!buckets[bucket]) buckets[bucket] = new Map();
    buckets[bucket].set(id, val);
  },
  async get(bucket: string, id: string) {
    return buckets[bucket]?.get(id);
  },
  async list(bucket: string) {
    return Array.from(buckets[bucket]?.values() ?? []);
  }
};
