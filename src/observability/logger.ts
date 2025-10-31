import pino from "pino";
export const logger = pino({ level: "info" });
export function logEvent(evt: Record<string, any>) {
  logger.info(evt);
}
