import { ItemType, ItemTier, SlotPosition } from '../types';

export const SLOT_POSITIONS: SlotPosition[] = [
  // Сверху - 3 иконки в ряд (горизонтально)
  { id: ItemType.CAP, name: 'Шапка', x: 60, y: 0, description: 'Головной убор для защиты от холода и стиля'},
  { id: ItemType.GLASSES, name: 'Очки', x: 0, y: 0, description: 'Оптический прибор для улучшения зрения'},
  { id: ItemType.NECKLACE, name: 'Ожерелье', x: 0, y: 0, description: 'Украшение на шею для красоты и статуса'},
  
  // Слева - 3 иконки вертикально друг под другом (прижаты ближе к краю)
  { id: ItemType.UNDERWEAR, name: 'Трусы', x: 4, y: 20, description: 'Нижнее белье для комфорта и гигиены'},
  { id: ItemType.RING, name: 'Кольцо', x: 4, y: 35, description: 'Украшение на палец как символ статуса'},
  { id: ItemType.SOCKS, name: 'Носки', x: 4, y: 50, description: 'Тепло и комфорт для ног'},
  
  // Справа - 3 иконки вертикально друг под другом
  { id: ItemType.SHIRT, name: 'Футболка', x: 75, y: 20, description: 'Верхняя одежда для торса и комфорта'},
  { id: ItemType.PANTS, name: 'Штаны', x: 75, y: 35, description: 'Нижняя одежда для ног и стиля'},
  { id: ItemType.SHOES, name: 'Обувь', x: 75, y: 50, description: 'Защита для стоп и стильный аксессуар'}
];

export const TIER_INFO = {
  [ItemTier.POOR]: {
    name: 'Нищук',
    color: '#999999'
  },
  [ItemTier.WORKER]: {
    name: 'Работяга', 
    color: '#4CAF50',
  },
  [ItemTier.RICH]: {
    name: 'Мажорище',
    color: '#FFA500',
  },
  [ItemTier.JEW]: {
    name: 'Дубайский синагой',
    color: '#9B59B6',
  }
};

// Supabase configuration is now handled in lib/supabase.ts
