# Архитектура frontend

Приложение работает как обычная Vue SPA через Vite/Node.js. Nuxt не используется.

```text
src/
  components/       повторно используемые доменные блоки
  composables/      загрузка данных и состояние запросов
  pages/            страницы маршрутов
  shared/           API и типы backend-контракта
  styles/theme.css  единая визуальная тема
public/images/      сохранённые legacy-материалы клуба
```

Backend остаётся источником данных. Все страницы используют единый API transport, состояния
loading/error/empty и общую визуальную тему. Page-specific стили не создаются без необходимости.
