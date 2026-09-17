import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { WordSchema, type Word } from "../src/schema.js";

type Direction = "across" | "down";
type Placed = { answer: string; clue_ko: string; direction: Direction; row: number; col: number };
type Grid = Map<string, string>;
type Placement = { row: number; col: number; direction: Direction; score: number };

const key = (r: number, c: number) => `${r},${c}`;

function canPlace(grid: Grid, word: string, row: number, col: number, direction: Direction) {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;
  let intersections = 0;
  let newCells = 0;

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = grid.get(key(r, c));
    if (existing) {
      if (existing !== word[i]) return { ok: false, intersections: 0 };
      intersections++;
    } else {
      newCells++;
    }
  }

  // For a word-fit puzzle we only require:
  //   1. at least one intersection (so words form a connected grid)
  //   2. at least one new cell (so we don't place a fully-redundant word)
  if (newCells === 0) return { ok: false, intersections: 0 };
  if (intersections < 1) return { ok: false, intersections: 0 };

  return { ok: true, intersections };
}

function placeWord(grid: Grid, word: string, row: number, col: number, direction: Direction) {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;
  for (let i = 0; i < word.length; i++) grid.set(key(row + dr * i, col + dc * i), word[i]);
}

function boundingBox(grid: Grid) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const k of grid.keys()) {
    const [r, c] = k.split(",").map(Number);
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (c < minC) minC = c; if (c > maxC) maxC = c;
  }
  return { minR, maxR, minC, maxC, width: maxC - minC + 1, height: maxR - minR + 1 };
}

function allPlacements(grid: Grid, word: string): Placement[] {
  const cells = [...grid.entries()].map(([k, ch]) => {
    const [r, c] = k.split(",").map(Number);
    return { r, c, ch };
  });
  const out: Placement[] = [];

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    for (const cell of cells) {
      if (cell.ch !== ch) continue;
      for (const dir of ["across", "down"] as Direction[]) {
        const dr = dir === "down" ? 1 : 0;
        const dc = dir === "across" ? 1 : 0;
        const row = cell.r - dr * i;
        const col = cell.c - dc * i;
        const { ok, intersections } = canPlace(grid, word, row, col, dir);
        if (!ok) continue;
        const temp = new Map(grid);
        placeWord(temp, word, row, col, dir);
        const bb = boundingBox(temp);
        const score = intersections * 200 - bb.width * bb.height;
        out.push({ row, col, direction: dir, score });
      }
    }
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tryOnce(order: Word[], topK: number) {
  const grid: Grid = new Map();
  const placements: Placed[] = [];

  const anchor = order[0];
  placeWord(grid, anchor.word, 0, 0, "across");
  placements.push({ answer: anchor.word, clue_ko: anchor.definition_ko, direction: "across", row: 0, col: 0 });

  for (let i = 1; i < order.length; i++) {
    const w = order[i];
    const cands = allPlacements(grid, w.word);
    if (cands.length === 0) continue;
    cands.sort((a, b) => b.score - a.score);
    const limit = Math.min(topK, cands.length);
    const pick = cands[Math.floor(Math.random() * limit)];
    placeWord(grid, w.word, pick.row, pick.col, pick.direction);
    placements.push({ answer: w.word, clue_ko: w.definition_ko, direction: pick.direction, row: pick.row, col: pick.col });
  }
  return { placements, grid };
}

function normalize(placements: Placed[], grid: Grid) {
  const bb = boundingBox(grid);
  const newGrid = new Map<string, string>();
  for (const [k, v] of grid) {
    const [r, c] = k.split(",").map(Number);
    newGrid.set(key(r - bb.minR, c - bb.minC), v);
  }
  const newPlacements = placements.map((p) => ({ ...p, row: p.row - bb.minR, col: p.col - bb.minC }));
  return { grid: newGrid, placements: newPlacements, width: bb.width, height: bb.height };
}

function main() {
  const WORDS_DIR = "src/words";
  const OUT_DIR = "src/puzzles";
  const ITERATIONS = 2000;
  mkdirSync(OUT_DIR, { recursive: true });

  for (const f of readdirSync(WORDS_DIR).filter((x) => x.endsWith(".json"))) {
    const m = f.match(/level-(\d)/);
    if (!m) continue;
    const level = Number(m[1]);
    const raw = JSON.parse(readFileSync(join(WORDS_DIR, f), "utf8"));
    const words: Word[] = raw.map((w: unknown) => WordSchema.parse(w));

    console.log(`\n📐 Level ${level} — ${words.length} words, ${ITERATIONS} restarts`);

    let best: { placements: Placed[]; grid: Grid } | null = null;
    for (let it = 0; it < ITERATIONS; it++) {
      const topK = it < ITERATIONS / 2 ? 1 : 3;
      const result = tryOnce(shuffle(words), topK);
      if (!best || result.placements.length > best.placements.length) {
        best = result;
        if (best.placements.length === words.length) break;
      }
    }
    if (!best) continue;

    const norm = normalize(best.placements, best.grid);
    const gridArr: (string | null)[][] = Array.from({ length: norm.height }, () =>
      Array.from({ length: norm.width }, () => null as string | null),
    );
    for (const [k, v] of norm.grid) {
      const [r, c] = k.split(",").map(Number);
      gridArr[r][c] = v;
    }

    const out = { level, width: norm.width, height: norm.height, grid: gridArr, entries: norm.placements };
    writeFileSync(join(OUT_DIR, `level-${level}.json`), JSON.stringify(out, null, 2));

    console.log(`  ✅ ${norm.placements.length}/${words.length} placed — ${norm.width}×${norm.height}\n`);
    for (let r = 0; r < norm.height; r++) {
      let line = "  ";
      for (let c = 0; c < norm.width; c++) line += gridArr[r][c] ?? "·";
      console.log(line);
    }
    console.log("");
  }
}

main();