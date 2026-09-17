import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { WordSchema, type Word } from "../src/schema.js";

const WORDS_DIR = "src/words";

type Loaded = { file: string; words: Word[] };

function loadAll(): Loaded[] {
  const files = readdirSync(WORDS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const path = join(WORDS_DIR, f);
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const parsed = raw.map((w: unknown) => WordSchema.parse(w));
    return { file: path, words: parsed };
  });
}

function main() {
  const loaded = loadAll();
  const seen = new Map<string, string>();
  const errors: string[] = [];
  let total = 0;

  for (const { file, words } of loaded) {
    for (const w of words) {
      total++;
      const prev = seen.get(w.word);
      if (prev) {
        errors.push(`duplicate "${w.word}" in ${file} (also in ${prev})`);
      } else {
        seen.set(w.word, file);
      }
    }
  }

  if (errors.length) {
    console.error(`\n❌ Validation failed with ${errors.length} error(s):\n`);
    for (const e of errors) console.error("  • " + e);
    console.error("");
    process.exit(1);
  }

  const byLevel = loaded.map(({ file, words }) => {
    const level = words[0]?.level ?? "?";
    return `  L${level}: ${words.length} words  (${file})`;
  });

  console.log(`\n✅ Validated ${total} words across ${loaded.length} level files:\n`);
  console.log(byLevel.join("\n"));
  console.log("");
}

main();
