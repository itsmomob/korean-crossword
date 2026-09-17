import { useMemo, useState } from "react";
import puzzleJson from "./puzzles/level-1.json";

type Entry = {
  answer: string;
  clue_ko: string;
  direction: "across" | "down";
  row: number;
  col: number;
};

type Puzzle = {
  level: number;
  width: number;
  height: number;
  grid: (string | null)[][];
  entries: Entry[];
};

const puzzle = puzzleJson as Puzzle;

/**
 * Assign a number to every cell that starts at least one entry,
 * scanning row-major. Cells that start both an across and a down
 * entry share the same number (standard crossword behavior).
 */
function computeNumbers(p: Puzzle): Map<string, number> {
  const numbers = new Map<string, number>();
  let next = 1;
  for (let r = 0; r < p.height; r++) {
    for (let c = 0; c < p.width; c++) {
      if (p.grid[r][c] === null) continue;
      if (p.entries.some((e) => e.row === r && e.col === c)) {
        numbers.set(`${r},${c}`, next++);
      }
    }
  }
  return numbers;
}

export default function App() {
  const [revealed, setRevealed] = useState(false);
  const numbers = useMemo(() => computeNumbers(puzzle), []);

  const withNums = useMemo(
    () =>
      puzzle.entries.map((e) => ({
        ...e,
        num: numbers.get(`${e.row},${e.col}`) ?? 0,
      })),
    [numbers]
  );

  const across = withNums
    .filter((e) => e.direction === "across")
    .sort((a, b) => a.num - b.num);
  const down = withNums
    .filter((e) => e.direction === "down")
    .sort((a, b) => a.num - b.num);

  return (
    <div className="app">
      <header>
        <h1>한국어 낱말 퍼즐</h1>
        <p>
          레벨 {puzzle.level} · {puzzle.entries.length}개 단어
        </p>
      </header>

      <div className="layout">
        <div className="grid-wrap">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`,
              gridTemplateRows: `repeat(${puzzle.height}, 1fr)`,
              aspectRatio: `${puzzle.width} / ${puzzle.height}`,
            }}
          >
            {puzzle.grid.flatMap((row, r) =>
              row.map((ch, c) => {
                const isBlock = ch === null;
                const num = numbers.get(`${r},${c}`);
                return (
                  <div
                    key={`${r}-${c}`}
                    className={isBlock ? "cell block" : "cell"}
                  >
                    {!isBlock && num !== undefined && (
                      <span className="cell-num">{num}</span>
                    )}
                    {!isBlock && revealed && (
                      <span className="cell-ch">{ch}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="clues">
          <button onClick={() => setRevealed((v) => !v)}>
            {revealed ? "정답 숨기기" : "정답 보기"}
          </button>

          <h2>가로</h2>
          <ul className="clue-list">
            {across.map((e) => (
              <li key={`a-${e.num}-${e.row}-${e.col}`}>
                <span className="clue-num">{e.num}</span>
                <span className="clue-text">{e.clue_ko}</span>
              </li>
            ))}
          </ul>

          <h2>세로</h2>
          <ul className="clue-list">
            {down.map((e) => (
              <li key={`d-${e.num}-${e.row}-${e.col}`}>
                <span className="clue-num">{e.num}</span>
                <span className="clue-text">{e.clue_ko}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}