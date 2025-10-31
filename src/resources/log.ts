export function router() {
  return async (path: string) => {
    // 演示：真实日志应读取 ndjson，这里返回占位
    return { entries: [], note: "log store is placeholder" };
  };
}
