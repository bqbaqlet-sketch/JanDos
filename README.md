# JanDos — запуск бесплатно / Қосу нұсқаулығы

PWA-сайт: работает на ПК и Android (кнопка «Установить»), на iPhone — Safari → «Поделиться» → «На экран Домой».
Стек (всё бесплатно): **GitHub Pages** (сайт) + **Supabase** (вход через Google, база, чат, фото) + **Gemini API** (ИИ).

## Структура
```
index.html, css/, js/, icons/, manifest.webmanifest, sw.js   ← сайт
js/config.js                                                  ← сюда вставить ключи Supabase
supabase/schema.sql                                           ← таблицы и правила доступа
supabase/functions/ai-assistant/                              ← ИИ-функция + prompt.ts (системный промпт Gemini)
```

## Шаг 1. Supabase
1. Зарегистрируйтесь на supabase.com → New project (регион ближайший, запомните пароль БД).
2. **SQL Editor** → вставьте весь `supabase/schema.sql` → Run.
3. **Project Settings → API**: скопируйте `Project URL` и `anon public key` в `js/config.js`.

## Шаг 2. Вход через Google
1. console.cloud.google.com → создайте проект → **APIs & Services → OAuth consent screen** (External) → заполните название и email.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: `https://<ваш-проект>.supabase.co/auth/v1/callback`
3. Скопируйте Client ID и Secret в Supabase: **Authentication → Providers → Google** → Enable.
4. Supabase **Authentication → URL Configuration**: Site URL = адрес вашего сайта (шаг 4), добавьте его же в Redirect URLs (для теста также `http://localhost:8080`).

## Шаг 3. ИИ (Gemini)
1. Ключ: aistudio.google.com → Get API key.
2. Установите Supabase CLI (`npm i -g supabase`), затем в папке проекта:
```
supabase login
supabase link --project-ref <ref проекта>
supabase secrets set GEMINI_API_KEY=ваш_ключ
supabase functions deploy ai-assistant
```
Модель по умолчанию `gemini-2.5-flash` (меняется секретом `GEMINI_MODEL`). Промпт редактируется в `supabase/functions/ai-assistant/prompt.ts`, после правки снова `deploy`.

> Бесплатный лимит Gemini ограничен. Если сайт станет популярным, добавьте лимит запросов на пользователя.

## Шаг 4. Публикация сайта
Залейте папку в репозиторий GitHub → Settings → Pages → Deploy from branch (`main`, `/root`). Адрес вида `https://имя.github.io/репо/`.
Локальная проверка: `python3 -m http.server 8080` и откройте http://localhost:8080.

## Шаг 5. Вы — администратор
Один раз войдите через Google на сайте, затем в SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ВАШ_EMAIL@gmail.com');
```

## Добавление ветеринаров (пока вручную)
В Supabase → Table Editor → `vets` → Insert row: `full_name, specialization, animals, city, clinic, experience_years, bio, photo_url, whatsapp, telegram`, и **`is_published = true`**. Когда пришлёте данные, я подготовлю готовый SQL и заполню главную страницу.

Чтобы ветеринар мог отвечать в чате: он входит через Google, затем в `vets` в его строке заполните `user_id` его id из таблицы `profiles`.

## Что осталось на потом
- Главная страница пока пустая-заглушка (по вашей просьбе).
- Модерация отзывов: админ может удалять любые отзывы (политика уже есть).
- Политика конфиденциальности и согласие ветеринаров на публикацию данных.
- Проверка промпта практикующим ветеринаром до запуска.
