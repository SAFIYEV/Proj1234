-- Rename item labels according to updated catalog naming

UPDATE items SET name = 'Часы с рынка' WHERE type = 'UNDERWEAR' AND tier = 'POOR';
UPDATE items SET name = 'Кварцевые часы' WHERE type = 'UNDERWEAR' AND tier = 'WORKER';
UPDATE items SET name = 'Rolex' WHERE type = 'UNDERWEAR' AND tier = 'RICH';
UPDATE items SET name = 'Часы Telegram' WHERE type = 'UNDERWEAR' AND tier IN ('JEW', 'DUBAI_SYNAGOGUE');

UPDATE items SET name = 'Носки с рынка' WHERE type = 'SOCKS' AND tier = 'POOR';
UPDATE items SET name = 'Чёрные носки' WHERE type = 'SOCKS' AND tier = 'WORKER';
UPDATE items SET name = 'Инопланетные носки' WHERE type = 'SOCKS' AND tier = 'RICH';
UPDATE items SET name = 'Носки Telegram' WHERE type = 'SOCKS' AND tier IN ('JEW', 'DUBAI_SYNAGOGUE');

UPDATE items SET name = 'Сапоги Telegram' WHERE type = 'SHOES' AND tier IN ('JEW', 'DUBAI_SYNAGOGUE');
UPDATE items SET name = 'Торс' WHERE type = 'SHIRT' AND tier IN ('JEW', 'DUBAI_SYNAGOGUE');

-- Temporary pricing setup requested by product owner
UPDATE items SET price = 1;
