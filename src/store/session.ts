export function ns(threadId: string, taskId?: string) {
  return [threadId, taskId ?? ""].filter(Boolean).join(":");
}
