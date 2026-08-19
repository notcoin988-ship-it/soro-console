// Публикация собранной консоли в ветку `gh-pages`.
//
// ЗАЧЕМ СКРИПТ, А НЕ ACTIONS. Автосборка при push требует у токена право
// `workflow`, которого у команды нет — GitHub отклоняет сам файл воркфлоу
// («refusing to allow an OAuth App to create or update workflow»). Здесь
// то же самое делается локально.
//
// ПОЧЕМУ ВРЕМЕННЫЙ РЕПОЗИТОРИЙ, А НЕ WORKTREE. Первая версия делала
// `git worktree add` и `checkout --orphan` — и падала: orphan-ветка в
// присоединённом дереве ведёт себя непредсказуемо. Отдельный маленький
// репозиторий во временной папке проще и не трогает рабочее дерево:
// история сборок не нужна, нужна последняя версия файлов.
//
//     npm run deploy

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BRANCH = "gh-pages";

function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    stdio: ["ignore", "pipe", "inherit"],
  })
    .toString()
    .trim();
}

// Имя репозитория задаёт базовый путь: сайт живёт в подпапке, и без
// префикса браузер ищет ассеты в корне домена, где их нет.
const remote = git(".", "remote", "get-url", "origin");
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
  cpSync("dist", work, { recursive: true });
  // Без этого файла Pages прогоняет сайт через Jekyll и выбрасывает всё,
  // что начинается с подчёркивания.
  writeFileSync(join(work, ".nojekyll"), "");

  git(work, "init", "-q");
  git(work, "checkout", "-q", "-b", BRANCH);
  git(work, "remote", "add", "origin", remote);
  git(work, "add", "-A");
  git(
    work,
    "-c",
    "user.email=deploy@zehnlab.ai",
    "-c",
    "user.name=soro-deploy",
    "commit",
    "-q",
    "-m",
    `Сборка консоли ${new Date().toISOString()}`,
  );
  // force: ветка содержит только последнюю сборку, сливать нечего.
  execFileSync("git", ["-C", work, "push", "-f", "origin", `HEAD:${BRANCH}`], {
    stdio: "inherit",
  });

  console.log(
    `\nготово: https://<аккаунт>.github.io/${repo}/` +
      `\nPages должен быть включён: Settings → Pages → Deploy from a branch → ${BRANCH} / (root)`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
