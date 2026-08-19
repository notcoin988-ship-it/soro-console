# Как выложить консоль

Публикация идёт **без GitHub Actions**: у токена команды нет права
`workflow`, и файл в `.github/workflows/` push отклоняет. Поэтому сборка
делается локально, а на Pages уходит готовая папка `dist` в ветке
`gh-pages`.

## Обновить выложенную версию

```
npm ci                       # один раз
npm run deploy               # сборка + публикация в gh-pages
```

После первой публикации: **Settings → Pages → Source: Deploy from a
branch → gh-pages / (root)**.

## Почему так, а не Actions

Автоматическая сборка при push удобнее, но требует расширить права токена
(`gh auth refresh -s workflow`). Когда права появятся — вернуть workflow из
истории и убрать ручной шаг.
