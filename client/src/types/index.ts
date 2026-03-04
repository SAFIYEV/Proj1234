export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  stars: number;
  referralCode: string;
  referredBy?: string;
  items: UserItem[];
  referralsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserItem {
  id: string;
  userId: string;
  itemId: string;
  equipped: boolean;
  createdAt: Date;
  item: Item;
}

export interface Item {
  id: string;
  type: ItemType;
  tier: ItemTier;
  name: string;
  price: number;
  coolness?: number;
  weared?: number;
  imageUrl?: string;
  createdAt: Date;
}

export enum ItemType {
  UNDERWEAR = 'UNDERWEAR',   // трусы
  SOCKS = 'SOCKS',           // носки  
  SHOES = 'SHOES',           // обувь
  PANTS = 'PANTS',           // штаны
  RING = 'RING',             // перстень
  SHIRT = 'SHIRT',           // футболка
  NECKLACE = 'NECKLACE',     // ожерелье
  GLASSES = 'GLASSES',       // очки
  CAP = 'CAP'                // кепка
}

export enum ItemTier {
  POOR = 'POOR',      // нищий - 1k stars
  WORKER = 'WORKER',  // работяга - 100k stars  
  RICH = 'RICH',      // мажор - 1M stars
  JEW = 'JEW'         // дубайский синагог - 10M stars
}

export interface PaymentData {
  title: string;
  description: string;
  prices: Array<{
    label: string;
    amount: number;
  }>;
  payload: string;
  currency: string;
}

export interface SlotPosition {
  id: ItemType;
  name: string;
  x: number;
  y: number;
  description: string;
}
