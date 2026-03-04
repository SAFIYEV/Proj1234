# Деплой фронтенда через Surge

## Подготовка

1. Установите Surge глобально:
```bash
npm install -g surge
```

2. Создайте аккаунт в Surge (если еще не создали):
```bash
surge login
```

## Настройка переменных окружения

1. Скопируйте файл `client/env.template` в `client/.env`:
```bash
cp client/env.template client/.env
```

2. Заполните переменные окружения в `client/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Деплой

Из директории `client/` выполните:

```bash
npm run deploy
```

Или выполните команды по отдельности:

```bash
# Собрать проект
npm run build

# Задеплоить на Surge
surge dist
```

## Настройка домена

По умолчанию приложение будет доступно по адресу `oden-pashu.surge.sh` (настроено в файле `CNAME`).

Чтобы изменить домен:
1. Измените содержимое файла `client/CNAME`
2. Пересоберите и задеплойте проект

## Автоматическое обновление

После каждого изменения в коде:

```bash
cd client
npm run deploy
```

## Полезные команды

```bash
# Список ваших доменов на Surge
surge list

# Удалить проект с Surge
surge teardown oden-pashu.surge.sh

# Проверить статус деплоя
surge whoami
```

## Troubleshooting

### Ошибка при сборке
- Убедитесь, что все переменные окружения заданы в `.env`
- Проверьте правильность настройки Supabase

### Ошибка 404 при переходе по ссылкам
- Убедитесь, что в папке `dist` есть файл `200.html` для SPA роутинга
- Добавьте файл `client/public/200.html` с содержимым `client/public/index.html`

### Ошибки подключения к Supabase
- Проверьте правильность URL и anon key
- Убедитесь, что RLS политики настроены корректно
