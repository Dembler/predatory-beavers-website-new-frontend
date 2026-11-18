# Проверка экспортируемого пакета: 18 ноября 2026

Проверен переносимый пакет для отдельной ветки сайта. Исходники runtime, установщика, шести навыков и шести ролей скопированы без изменения логики. Локальная глобальная установка Codex не изменялась.

## Выполненные проверки

Среда: Windows, Python 3.12.10, pytest 9.0.2, Ruff 0.16.1.

1. Полный набор тестов:

   ```text
   python -m pytest tests -q -p no:cacheprovider --basetemp <изолированный-каталог-вне-репозитория>
   31 passed, 1 skipped, 3 subtests passed in 38.68s
   ```

   Symlink-тест пропущен из-за недоступного создания symlink в текущей Windows-среде. Остальные проверки состояния, ownership, ревью, снимков, установщика, конфликтов и отката прошли.

2. Dry-run реального CLI установщика в отдельный target: сформирован план 21 файла навыков/ролей и манифеста, `dry-run: no files changed`.

3. Все 27 экспортированных исходных файлов совпадают по SHA256 с [PACKAGE-MANIFEST.json](PACKAGE-MANIFEST.json). Шесть role TOML разобраны стандартным `tomllib`; обязательные поля присутствуют, model override отсутствует. Отдельное read-only сравнение подтвердило совпадение 21 устанавливаемого файла с текущими файлами пользователя.

4. Базовая статическая проверка пяти Python-файлов:

   ```text
   python -m ruff check --isolated --select E4,E7,E9,F --target-version py311 install.py verify_install.py skills/agent-workflow/scripts/workflow.py tests/test_install.py tests/test_workflow.py
   All checks passed!
   ```

5. Форматирование с длиной строки исходного пакета 100:

   ```text
   python -m ruff format --check --isolated --target-version py311 --line-length 100 --quiet install.py verify_install.py skills/agent-workflow/scripts/workflow.py tests/test_install.py tests/test_workflow.py
   exit 0
   ```

6. Экспорт отобран явным списком: installer, verifier, README, tests, skills и workflow-* roles. Пользовательский config, credentials, сессии, bytecode и каталоги прошлых запусков не включены. Проверка характерных private-key/GitHub-token/API-key шаблонов в текстах не нашла совпадений; это дополнительная проверка к явному списку, а не универсальный детектор секретов.

## Дополнительная диагностика

Более широкий локальный lint-профиль Ruff сообщил пять замечаний к исходному стилю: два generic exception handler, set comprehension, explicit subprocess check и import ordering. Перенос их не исправляет: runtime и installer сохраняются как в используемой версии. Проверка форматирования с другим пределом 88 символов также предлагает изменения; для исходного пакета проверен предел 100.

## Границы результата

- Тесты и dry-run не устанавливают пакет глобально и не меняют Codex settings.
- Fresh discovery через `verify_install.py` в рамках этой отправки не запускался. Наличие файлов ролей и успешный TOML parse не доказывают их invocation или доступность в другой версии Codex.
- Пакет требует отдельной установки на другой машине и нового чата для обнаружения ролей. Verifier использует методы локального app-server, совместимость которых проверяется на целевой версии.
- Тесты workflow не доказывают качество реализации Бобрика или работу публичного сайта. Код и deployment сайта этой веткой не меняются.
- PACKAGE-MANIFEST описывает 27 скопированных файлов; текущий отчёт и git attributes — файлы экспорта и не входят в исходный манифест.
