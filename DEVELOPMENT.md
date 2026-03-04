# 🛠 Инструкция по разработке

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm run install:all
```

### 2. Настройка переменных окружения
Создайте файл `.env` в корне проекта:
```env
# Telegram Bot
BOT_TOKEN=your_bot_token_here
WEBHOOK_URL=http://localhost:3001/webhook

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/oden_pashu

# App Configuration
CLIENT_URL=http://localhost:5173
API_URL=http://localhost:3000/api

# Environment
NODE_ENV=development
```

### 3. Запуск базы данных (Docker)
```bash
docker run --name oden-pashu-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=oden_pashu \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### 4. Настройка базы данных
```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

### 5. Запуск в режиме разработки
```bash
npm run dev
```

Это запустит:
- Backend API на http://localhost:3000
- Frontend TMA на http://localhost:5173
- Bot в polling режиме

## 📁 Структура проекта

```
oden_pashu/
├── bot/                 # Telegram Bot
│   ├── src/
│   │   ├── services/   # API сервисы, генерация изображений
│   │   ├── types/      # TypeScript типы
│   │   └── index.ts    # Основной файл бота
│   └── package.json
├── server/             # Backend API
│   ├── src/
│   │   ├── routes/     # API роуты
│   │   ├── services/   # Бизнес логика
│   │   ├── middleware/ # Middleware (auth, etc.)
│   │   ├── utils/      # Утилиты
│   │   └── types/      # TypeScript типы
│   ├── prisma/         # База данных
│   └── package.json
├── client/             # Frontend TMA
│   ├── src/
│   │   ├── components/ # React компоненты
│   │   ├── stores/     # Zustand стейт
│   │   ├── services/   # API клиенты
│   │   ├── hooks/      # Custom hooks
│   │   └── types/      # TypeScript типы
│   └── package.json
└── package.json        # Root package.json
```

## 🔧 API Endpoints

### Users
- `GET /api/users/me` - Получить профиль пользователя
- `GET /api/users/telegram/:telegramId` - Получить пользователя по Telegram ID

### Items  
- `GET /api/items` - Получить все предметы
- `GET /api/items/type/:type` - Получить предметы по типу

### Payments
- `POST /api/payments/create` - Создать платеж
- `POST /api/payments/success` - Обработать успешный платеж
- `POST /api/payments/refund` - Обработать рефанд

### Webhooks
- `POST /webhook/telegram` - Webhook для Telegram обновлений

## 🗄️ База данных

### Модели:
- **User** - Пользователи
- **Item** - Предметы одежды
- **UserItem** - Принадлежащие пользователю предметы
- **Payment** - История платежей

### Миграции:
```bash
# Создать новую миграцию
npx prisma migrate dev --name migration_name

# Применить миграции в продакшн
npx prisma migrate deploy

# Генерация Prisma клиента
npx prisma generate
```

## 🎨 Frontend

### Основные компоненты:
- **PashuAvatar** - Аватар с слотами одежды
- **ShopModal** - Модальное окно магазина
- **UserStats** - Статистика пользователя

### Стейт менеджмент (Zustand):
- **useUserStore** - Состояние пользователя
- **useItemsStore** - Состояние предметов

### Стили (Tailwind CSS):
- Темная тема с акцентными цветами
- Responsive дизайн для мобильных устройств
- Кастомные анимации и переходы

## 🤖 Telegram Bot

### Команды:
- `/start` - Начало работы с ботом
- `/help` - Помощь по использованию

### Inline режим:
Пользователи могут использовать `@your_bot_username` в любом чате для шаринга своего Паши.

### Обработка платежей:
- Pre-checkout queries для валидации
- Successful payments для обработки
- Автоматическое начисление бонусов рефералам

## 💳 Платежи

### Telegram Stars:
- Создание invoice через Bot API
- Обработка через webhook
- Автоматическое начисление предметов
- Обработка рефандов

### Система рефералов:
- 10% с каждой покупки приглашенного пользователя
- Автоматическое начисление бонусов
- Уникальные реферальные коды

## 🧪 Тестирование

### Локальное тестирование:
1. Используйте ngrok для создания туннеля к localhost
2. Настройте webhook URL на ngrok адрес
3. Тестируйте через реального Telegram бота

### Unit тесты:
```bash
# Установите jest
npm install --save-dev jest @types/jest

# Запустите тесты
npm test
```

## 📝 Добавление новых фич

### Новый предмет одежды:
1. Добавьте новый `ItemType` в `types/index.ts`
2. Обновите `SLOT_POSITIONS` в `utils/constants.ts`
3. Добавьте предмет в `seedDatabase.ts`
4. Запустите миграцию базы данных

### Новый уровень качества:
1. Добавьте новый `ItemTier` в типы
2. Обновите `TIER_INFO` и цены
3. Добавьте в систему генерации предметов

## 🔍 Отладка

### Логи:
- Backend: консоль сервера
- Bot: консоль бота + Telegram Bot API логи
- Frontend: консоль браузера + Network tab

### Частые проблемы:
1. **CORS ошибки** - проверьте настройки в server/src/index.ts
2. **Telegram auth failed** - проверьте валидацию в middleware/auth.ts
3. **Database connection** - проверьте DATABASE_URL
4. **Bot не отвечает** - проверьте BOT_TOKEN и webhook

## 🔄 Workflow разработки

1. Создайте feature branch
2. Внесите изменения
3. Протестируйте локально
4. Создайте Pull Request
5. После merge деплой происходит автоматически

## 📚 Полезные ресурсы

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://docs.telegram-mini-apps.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [React Query](https://tanstack.com/query/latest)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
