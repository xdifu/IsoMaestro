export class McpError extends Error { code: string; details?: any; constructor(code: string, msg: string, d?: any){ super(msg); this.code=code; this.details=d; } }
export const policyDenied = (m:string)=> new McpError("POLICY_DENIED", m);
export const needsApproval = (action:string, reason:string, details:any)=>({ status:"approval_required", action, reason, details, approvalToken: crypto.randomUUID() });
