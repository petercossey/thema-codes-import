import { z } from 'zod';

// Zod schema for Thema code validation
export const ThemaCodeSchema = z.object({
  CodeValue: z.string().min(1),
  CodeDescription: z.string().min(1),
  CodeNotes: z.string(),
  CodeParent: z.string(),
  IssueNumber: z.number(),
  Modified: z.union([z.string(), z.number()])
});

// TypeScript type derived from schema
export type ThemaCode = z.infer<typeof ThemaCodeSchema>;

// Schema for array of Thema codes
export const ThemaCodesSchema = z.array(ThemaCodeSchema); 