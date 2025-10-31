export const policy = {
  http: {
    allowDomains: ["example.com", "api.example.org"],
    denyDomains: ["169.254.169.254", "metadata.google.internal"],
    allow(url: string) {
      try {
        const u = new URL(url);
        return this.allowDomains.some(d => u.hostname.endsWith(d));
      } catch { return false; }
    },
    mayApprove(url: string) {
      // 可配置“审核后放行”的灰名单
      return false;
    }
  },
  fs: {
    writablePrefixes: ["./artifacts/"],
    isWritable(p: string) { return this.writablePrefixes.some(pre => p.startsWith(pre)); }
  },
  runtime: {
    defaultTimeoutMs: 60_000,
    cpuLimit: 1,
    memMb: 1024
  }
};
