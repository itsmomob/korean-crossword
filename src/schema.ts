import { z } from "zod";

export const LevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const PosSchema = z.enum([
  "명사",
  "동사",
  "형용사",
  "부사",
  "대명사",
  "수사",
  "관형사",
  "감탄사",
]);

export const WordSchema = z
  .object({
    word: z.string().min(1),
    level: LevelSchema,
    pos: PosSchema,
    definition_ko: z.string().min(5),
    example_ko: z.string().min(5),
    synonyms: z.array(z.string()).default([]),
    antonyms: z.array(z.string()).default([]),
    collocations: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  })
  .superRefine((w, ctx) => {
    if (w.word.includes(" ")) {
      ctx.addIssue({
        code: "custom",
        message: `"${w.word}" contains a space — not allowed in crossword entries`,
      });
    }

    const stem = w.word.slice(0, Math.max(1, w.word.length - 1));
    if (!w.example_ko.includes(stem)) {
      ctx.addIssue({
        code: "custom",
        message: `example_ko for "${w.word}" does not contain the word stem "${stem}"`,
      });
    }

    if (w.antonyms.includes(w.word)) {
      ctx.addIssue({ code: "custom", message: `"${w.word}" is its own antonym` });
    }
    if (w.synonyms.includes(w.word)) {
      ctx.addIssue({ code: "custom", message: `"${w.word}" is its own synonym` });
    }
  });

export type Word = z.infer<typeof WordSchema>;
