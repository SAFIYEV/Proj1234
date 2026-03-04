# 🚀 Инструкция по деплою "Одень Пашу"

## 📋 Содержание
1. [Предварительная настройка](#предварительная-настройка)
2. [Создание Telegram бота](#создание-telegram-бота)
3. [Деплой базы данных](#деплой-базы-данных)
4. [Деплой backend API](#деплой-backend-api)
5. [Деплой frontend (TMA)](#деплой-frontend-tma)
6. [Деплой Telegram бота](#деплой-telegram-бота)
7. [Настройка webhook](#настройка-webhook)
8. [Финальная настройка](#финальная-настройка)

## 🛠 Предварительная настройка

### Необходимые аккаунты:
- [Railway](https://railway.app) - для backend и бота
- [Supabase](https://supabase.com) или [Neon](https://neon.tech) - для PostgreSQL базы данных
- [Vercel](https://vercel.com) - для frontend
- Telegram аккаунт для создания бота

### Требования:
- Node.js 18+
- Git
- Аккаунт на GitHub

## 🤖 Создание Telegram бота

1. Перейдите в [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Укажите имя бота: `Одень Пашу`
4. Укажите username: `oden_pashu_bot` (или любой доступный)
5. Сохраните полученный токен - он понадобится для переменных окружения
6. Настройте бота:
   ```
   /setdescription - Игра "Одень Пашу" - создай уникальный образ!
   /setabouttext - Одевай своего Пашу в крутую одежду и соревнуйся с друзьями!
   /setuserpic - (загрузите картинку с Пашей)
   ```
7. Включите inline режим: `/setinline`
8. Включите платежи: `/setpayments` и выберите провайдера

## 🗄️ Деплой базы данных

### Вариант 1: Supabase (рекомендуется)
1. Зарегистрируйтесь на [Supabase](https://supabase.com)
2. Создайте новый проект
3. Перейдите в Settings → Database
4. Скопируйте Connection String (URI)
5. Замените `[YOUR-PASSWORD]` на пароль от вашей базы

### Вариант 2: Neon
1. Зарегистрируйтесь на [Neon](https://neon.tech)
2. Создайте новую базу данных
3. Скопируйте Connection String

Сохраните строку подключения - она понадобится для переменных окружения.

## 🔧 Деплой backend API

### Railway
1. Зарегистрируйтесь на [Railway](https://railway.app)
2. Подключите ваш GitHub аккаунт
3. Нажмите "New Project" → "Deploy from GitHub repo"
4. Выберите репозиторий с проектом
5. Установите переменные окружения:
   ```
   BOT_TOKEN=your_bot_token_here
   DATABASE_URL=your_database_connection_string
   CLIENT_URL=https://your-vercel-app.vercel.app
   NODE_ENV=production
   ```
6. Railway автоматически определит Dockerfile и начнет деплой
7. После деплоя скопируйте URL вашего API (что-то вроде `https://your-app.railway.app`)

### Инициализация базы данных
1. Подключитесь к Railway через CLI или используйте веб-терминал
2. Выполните миграции:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

## 🌐 Деплой frontend (TMA)

### Vercel
1. Зарегистрируйтесь на [Vercel](https://vercel.com)
2. Подключите GitHub аккаунт
3. Нажмите "New Project"
4. Выберите ваш репозиторий
5. Настройте сборку:
   - Build Command: `cd client && npm run build`
   - Output Directory: `client/dist`
   - Install Command: `cd client && npm install`
6. Установите переменные окружения:
   ```
   VITE_API_URL=https://your-railway-api.railway.app/api
   ```
7. Нажмите "Deploy"
8. После деплоя скопируйте URL (что-то вроде `https://your-app.vercel.app`)

## 🤖 Деплой Telegram бота

### Railway (отдельный сервис)
1. Создайте новый проект в Railway
2. Выберите "Deploy from GitHub repo"
3. В настройках сборки укажите:
   - Dockerfile: `Dockerfile.bot`
4. Установите переменные окружения:
   ```
   BOT_TOKEN=your_bot_token_here
   API_URL=https://your-railway-api.railway.app/api
   WEBHOOK_URL=https://your-bot-railway.railway.app
   NODE_ENV=production
   ```
5. Деплойте проект

## 🔗 Настройка webhook

1. Обновите переменную `WEBHOOK_URL` в backend API:
   ```
   WEBHOOK_URL=https://your-bot-railway.railway.app
   ```
2. Обновите настройки бота через [@BotFather](https://t.me/BotFather):
   ```
   /setmenubutton
   Выберите вашего бота
   Укажите:
   - Text: 🎭 Одеть Пашу
   - URL: https://your-vercel-app.vercel.app
   ```

## ⚙️ Финальная настройка

### 1. Обновите ссылки в коде
В файле `UserStats.tsx` замените placeholder ссылку:
```typescript
const referralLink = `https://t.me/your_bot_username?start=${user.referralCode}`;
```

### 2. Настройте Telegram Mini App
1. Перейдите в [@BotFather](https://t.me/BotFather)
2. Выберите вашего бота
3. Настройте Mini App:
   ```
   /newapp
   Выберите вашего бота
   Название: Одень Пашу
   Описание: Одевай своего Пашу в крутую одежду!
   URL: https://your-vercel-app.vercel.app
   Загрузите иконку (512x512 px)
   ```

### 3. Протестируйте функциональность
- [ ] Регистрация нового пользователя
- [ ] Показ слотов одежды
- [ ] Открытие магазина
- [ ] Создание платежа
- [ ] Обработка платежа через webhook
- [ ] Inline команды
- [ ] Реферальная система

## 🚨 Переменные окружения

### Backend API (Railway):
```env
BOT_TOKEN=your_bot_token_here
DATABASE_URL=postgresql://user:password@host:port/database
CLIENT_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
```

### Bot (Railway):
```env
BOT_TOKEN=your_bot_token_here
API_URL=https://your-railway-api.railway.app/api
WEBHOOK_URL=https://your-bot-railway.railway.app
NODE_ENV=production
```

### Frontend (Vercel):
```env
VITE_API_URL=https://your-railway-api.railway.app/api
```

## 🔍 Отладка

### Проверка логов:
- Railway: Dashboard → Deployments → View Logs
- Vercel: Dashboard → Functions → View Logs

### Частые проблемы:
1. **База данных не подключается** - проверьте `DATABASE_URL`
2. **Bot не отвечает** - проверьте `BOT_TOKEN` и webhook URL
3. **Платежи не работают** - убедитесь что бот настроен для платежей в BotFather
4. **CORS ошибки** - проверьте `CLIENT_URL` в backend

## 📱 Тестирование

1. Откройте вашего бота в Telegram
2. Нажмите `/start`
3. Нажмите кнопку "Одеть Пашу"
4. Проверьте загрузку TMA
5. Протестируйте покупку предмета
6. Проверьте inline команды: напишите `@your_bot_username` в любом чате

## 🎉 Готово!

Ваше приложение "Одень Пашу" готово к использованию! 

### Полезные ссылки:
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://docs.telegram-mini-apps.com/)
- [Railway Docs](https://docs.railway.app/)
- [Vercel Docs](https://vercel.com/docs)
