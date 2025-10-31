import { z } from "zod";
export const EvidenceCard = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().max(600),
  anchors: z.array(z.string()),
  freshness: z.string().optional(),
  confidence: z.number().min(0).max(1),
  sourceUrl: z.string().url().optional()
});
export const EvidenceCardList = z.object({ items: z.array(EvidenceCard) });
export type EvidenceCardT = z.infer<typeof EvidenceCard>;
