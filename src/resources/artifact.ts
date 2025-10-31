export function router() {
  return async (path: string) => {
    // 演示：真实产物应从对象存储读取，这里返回占位
    return { artifacts: [], note: "artifact store is placeholder" };
  };
}
