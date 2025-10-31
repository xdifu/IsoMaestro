import { needsApproval, policyDenied } from "../utils/errors.js";
import { policy } from "../config/policy.js";
import { setImmediate } from "node:timers";

export async function httpFetch(url: string, opts: any) {
  if (!policy.http.allow(url)) {
    if (policy.http.mayApprove(url)) {
      return needsApproval("http_fetch", `Access to ${url} requires approval`, { url });
    }
    throw policyDenied(`HTTP not allowed: ${url}`);
  }
  // 这里可以用 undici fetch；示例先返回假数据：
  return { status: 200, body: "OK", url };
}

export async function writeFileSafe(path: string, data: string) {
  if (!policy.fs.isWritable(path)) throw policyDenied(`Write not allowed: ${path}`);
  // 示例：跳过实际写盘
  await new Promise(r => setImmediate(r));
  return { ok: true, path };
}
