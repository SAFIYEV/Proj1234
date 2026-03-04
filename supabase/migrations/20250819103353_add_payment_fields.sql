-- Добавляем недостающие поля в таблицу payments для совместимости с Telegram Stars API

-- Добавляем поле telegram_id для связи с пользователем Telegram
ALTER TABLE payments ADD COLUMN telegram_id TEXT;

-- Добавляем поле payload для хранения payload инвойса
ALTER TABLE payments ADD COLUMN payload TEXT;

-- Создаём индексы для быстрого поиска
CREATE INDEX idx_payments_telegram_id ON payments(telegram_id);
CREATE INDEX idx_payments_payload ON payments(payload);

-- Обновляем существующие записи, если есть (заполняем telegram_id из таблицы users)
UPDATE payments SET telegram_id = (
  SELECT users.telegram_id 
  FROM users 
  WHERE users.id = payments.user_id
) WHERE telegram_id IS NULL;
