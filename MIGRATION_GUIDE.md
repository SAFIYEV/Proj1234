# 🔄 Миграция на Supabase + Surge

## Что изменилось

✅ **Новая архитектура:**
- **Frontend**: React + TypeScript + Vite → деплой через **Surge**
- **Backend**: Удален Express сервер → используем **Supabase**
- **Bot**: Остался без изменений

## Пошаговая миграция

### 1. Настройка Supabase

1. Создайте проект в [Supabase](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните SQL из файла `supabase-schema.sql`
4. Сохраните URL проекта и Anon Key

### 2. Настройка переменных окружения

```bash
cd client
cp env.template .env
```

Заполните `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Установка зависимостей

```bash
# Устанавливаем новые зависимости фронтенда
cd client
npm install

# Устанавливаем Surge глобально
npm install -g surge
```

### 4. Тестирование локально

```bash
cd client
npm run dev
```

### 5. Деплой на Surge

```bash
cd client
npm run deploy
```

При первом деплое Surge попросит:
- Email и пароль (для регистрации)
- Домен (можете оставить предложенный `oden-pashu.surge.sh`)

## Что удалено

- 🗂️ Папка `server/` - больше не нужна
- 🐳 `Dockerfile.server` - Docker файлы для сервера
- 🐳 `docker-compose.yml` - Docker Compose конфигурация
- ☁️ `vercel.json` - конфигурация Vercel
- 🚄 `railway.json` - конфигурация Railway

## Новые файлы

- 📄 `supabase-schema.sql` - SQL схема для Supabase
- 📄 `client/lib/supabase.ts` - Supabase клиент
- 📄 `client/env.template` - Шаблон переменных окружения
- 📄 `client/CNAME` - Домен для Surge
- 📄 `SURGE_DEPLOYMENT.md` - Инструкция по деплою

## Изменения в коде

### API сервис (`client/src/services/api.ts`)
- ❌ Удален `axios` и REST API вызовы
- ✅ Добавлен прямой Supabase клиент
- ✅ Реализованы все функции через Supabase API

### Типы (`client/src/types/index.ts`)
- ✅ Обновлены под новую структуру данных
- ✅ Добавлены поля `referralsCount`, `createdAt`, `updatedAt`

### Компоненты
- ✅ `PashuAvatar` - обновлен для работы с новой структурой `UserItem`
- ✅ `UserStats` - добавлено отображение количества рефералов

### Package.json
- ✅ Добавлен `@supabase/supabase-js`
- ✅ Добавлен `surge` для деплоя
- ❌ Удален `axios`

## Проверка работоспособности

1. **База данных**: Проверьте, что таблицы созданы в Supabase
2. **RLS**: Убедитесь, что Row Level Security политики активны
3. **Фронтенд**: Тестируйте локально `npm run dev`
4. **Деплой**: Проверьте, что `npm run deploy` работает

## Преимущества новой архитектуры

✅ **Простота**: Меньше серверного кода для поддержки  
✅ **Скорость**: Прямые запросы к Supabase  
✅ **Безопасность**: Row Level Security из коробки  
✅ **Масштабируемость**: Supabase автоматически масштабирует  
✅ **Стоимость**: Бесплатный план Supabase + бесплатный Surge  

## Возможные проблемы

❗ **Telegram Bot**: Возможно потребуется обновить bot для работы с Supabase  
❗ **Payments**: Webhook'и теперь должны обрабатываться на клиенте  
❗ **CORS**: Убедитесь, что домен Surge добавлен в настройки Supabase  

## Откат

Если что-то пойдет не так, можно откатиться к предыдущей версии:
```bash
git checkout HEAD~1
```

## Поддержка

Если возникли проблемы:
1. Проверьте настройки Supabase
2. Убедитесь, что все переменные окружения заполнены
3. Проверьте консоль браузера на ошибки
4. Проверьте логи Supabase в Dashboard
