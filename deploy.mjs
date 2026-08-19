// Публикация собранной консоли в ветку `gh-pages`.
//
// ЗАЧЕМ СКРИПТ, А НЕ ACTIONS. Автосборка при push требует у токена право
// `workflow`, которого у команды нет — GitHub отклоняет сам файл
// воркфлоу. Здесь то же самое делается локально: собрать и положить
// готовую папку в отдельную ветку, откуда Pages её и раздаёт.
//
// ПОЧЕМУ ОТДЕЛЬНАЯ ВЕТКА. В `main` лежат исходники, и держать рядом с
// ними собранный `dist` — значит коммитить его при каждой правке и ловить
// конфликты в файлах, которые никто не читает.
//
//     node deploy.mjs
//
// Ветка перезаписывается целиком: история сборок не нужна, нужна
// последняя. Рабочее дерево при этом не трогается — используется
// `git worktree` во временной папке.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BRANCH = "gh-pages";

function git(...args) {
  return execFileSync("git", args, { stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();
}

// Имя репозитория задаёт базовый путь: сайт живёт в подпапке, и без
// префикса браузер ищет ассеты в корне домена, где их нет.
const remote = git("remote", "get-url", "origin");
const repo = remote.replace(/\.git$/, "").split("/").pop();
console.log(`репозиторий: ${repo}`);

console.log("сборка…");
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_BASE: `/${repo}/` },
});

const work = mkdtempSync(join(tmpdir(), "soro-pages-"));
try {
  // Ветку каждый раз создаём заново от пустого состояния: иначе к сборке
  // прилипают файлы предыдущей, которых больше нет в `dist`.
  try {
    git("worktree", "add", "--detach", work);
  } catch {
    console.error("не удалось создать worktree");
    throw new Error("worktree");
  }

  execFileSync("git", ["-C", work, "checkout", "--orphan", BRANCH], { stdio: "inherit" });
  execFileSync("git", ["-C", work, "rm", "-rf", "--quiet", "."], { stdio: "inherit" });

  cpSync("dist", work, { recursive: true });
  // Без этого файла GitHub Pages прогоняет страницу через Jekyll и
  // выбрасывает всё, что начинается с подчёркивания.
  writeFileSync(join(work, ".nojekyll"), "");

  execFileSync("git", ["-C", work, "add", "-A"], { stdio: "inherit" });
  execFileSync(
    "git",
    ["-C", work, "commit", "-q", "-m", `Сборка консоли ${new Date().toISOString()}`],
    { stdio: "inherit" },
  );
  execFileSync("git", ["-C", work, "push", "-f", "origin", `HEAD:${BRANCH}`], {
    stdio: "inherit",
  });

  console.log(`\nготово. Включите Pages: Settings → Pages → Deploy from a branch → ${BRANCH} / (root)`);
} finally {
  rmSync(work, { recursive: true, force: true });
  try {
    git("worktree", "prune");
  } catch {
    /* worktree мог не создаться — тогда и убирать нечего */
  }
}
