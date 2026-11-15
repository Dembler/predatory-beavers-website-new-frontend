# Frontend на GitHub Pages

Подготовлен workflow `.github/workflows/pages.yml`. Он публикует только frontend из `dist`;
backend, база, загруженные через админку фотографии и ключ FIBA в Pages не попадают.
Workflow использует официальные [GitHub Pages Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

1. В репозитории frontend откройте **Settings → Pages → Build and deployment → GitHub Actions**.
2. В **Settings → Secrets and variables → Actions → Variables** добавьте `VITE_API_BASE_URL`:
   публичный HTTPS origin backend, например `https://api.example.org`, без `/api`, пути и ключей.
   Это публичная настройка, она будет видна в JavaScript. Пароли и API-ключи сюда не добавляют.
3. После загрузки изменений в `main` workflow соберёт сайт и опубликует Pages. Его можно запустить
   вручную во вкладке Actions. Пока `VITE_API_BASE_URL` не задана, сборка и публикация пропускаются.
   После добавления адреса запустите workflow вручную или отправьте следующий коммит в `main`.
   Заданный адрес по-прежнему проверяется: требуется публичный HTTPS origin без пути и ключей.

Адрес текущего репозитория будет
`https://dembler.github.io/predatory-beavers-website-new-frontend/`.
Workflow получает origin и каталог из `actions/configure-pages`, поэтому поддерживает также
пользовательский домен. Вручную менять пути в исходниках не нужно. Локальный `npm run dev`
продолжает работать от `/` с Vite proxy на backend `127.0.0.1:8000`.

## Backend и вход в админку

Backend должен разрешать **точный origin frontend** в CORS (для стандартного Pages это
`https://dembler.github.io`, без каталога репозитория), с credentials и нужными заголовками CSRF.
Запросы frontend уже используют `credentials: include`. На backend сессия должна иметь Secure
cookie и `SameSite=None` для разных сайтов; HTTPS обязателен с обеих сторон.

Браузеры могут блокировать такие cookies как third-party даже при правильном CORS. Для надёжной
админки предпочтителен собственный домен: например frontend `www.example.org` на Pages и backend
`api.example.org`. Пока frontend работает на `github.io`, возможность входа и сохранения нужно
проверять в целевых браузерах; публичные страницы от cookies не зависят.

Относительные `/media/...` URL загруженных файлов направляются на backend. Клубные `/images/...`,
эмблема, шрифты и статические фотографии загружаются с Pages с учётом каталога репозитория.

## Маршруты и проверки

Сохраняется HTML5 history. `404.html` переводит прямую ссылку в корень репозитория, затем короткий
скрипт в `index.html` восстанавливает исходный маршрут, query и anchor перед запуском Vue.
Это позволяет открывать и обновлять `/club`, `/admin`, профили игроков и фильтры матчей.
Первый ответ на прямую ссылку остаётся 404 на стороне GitHub; переход выполняется JavaScript.
Без JavaScript содержимое SPA не отображается. Для полноценного индексируемого HTML используйте
отдельный существующий prerender pipeline; эта конфигурация его не запускает.

Локальная проверка сборки (адрес API приведён как пример, его нужно заменить своим):

```powershell
$env:VITE_API_BASE_URL = 'https://api.example.org'
$env:VITE_BASE_PATH = '/predatory-beavers-website-new-frontend/'
$env:VITE_SITE_URL = 'https://dembler.github.io'
npm.cmd run test:pages
npm.cmd run build:pages
npm.cmd run test:pages:browser
```

Браузерная проверка требует Chromium из `npx.cmd playwright install chromium`. Она запускает
готовую сборку в каталоге Pages, имитирует статический 404, проверяет прямой переход, перезагрузку,
query/anchor, canonical URL, загрузку фотографий/стилей/шрифтов и отдельный HTTPS адрес API.
Workflow выполняет эту проверку перед загрузкой артефакта.

В Pages нет Vite proxy и файлов `.env` сервера. После изменения `VITE_API_BASE_URL` нужна новая
сборка workflow. Обновление матчей не требует пересборки: сайт получает свежие данные от API.
