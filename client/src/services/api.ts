import { supabase, Tables } from '../lib/supabase';
import { initData } from '@telegram-apps/sdk-react';
import { User, Item, PaymentData, ItemType, ItemTier } from '../types';

export type WorkCardModel = {
  id: string;
  code: string;
  title: string;
  description: string;
  unlockPrice: number;
  profitPerHour: number;
  imageUrl?: string;
};

export type UserWorkModel = {
  id: string;
  workCardId: string;
  purchasedAt: number;
  lastClaimAt: number;
  totalEarned: number;
};

const resolveImageUrl = (url: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  // Local generated assets are served from /img in Vite public folder.
  // Also handle legacy /images and _jew filename variants.
  const normalized = url.replace('/images/', '/img/').replace('_jew.png', '_dubai.png');
  if (normalized.startsWith('/')) return `${import.meta.env.BASE_URL}${normalized.slice(1)}`;
  return `${import.meta.env.BASE_URL}${normalized}`;
};

// Helper function to transform Supabase user to our User type
const transformUser = (
  user: Tables<'users'>, 
  items: Array<Tables<'user_items'> & { item: Tables<'items'> }> = [],
  referralsCount: number = 0
): User => ({
  id: user.id,
  telegramId: user.telegram_id,
  username: user.username || undefined,
  firstName: user.first_name || undefined,
  lastName: user.last_name || undefined,
  stars: user.stars,
  referralCode: user.referral_code,
  referredBy: user.referred_by || undefined,
  items: items.map(userItem => ({
    id: userItem.id,
    userId: userItem.user_id,
    itemId: userItem.item_id,
    equipped: userItem.equipped,
    createdAt: new Date(userItem.created_at),
          item: {
        id: userItem.item.id,
        type: userItem.item.type as ItemType,
        tier: userItem.item.tier as ItemTier,
        name: userItem.item.name,
        price: userItem.item.price,
        coolness: userItem.item.coolness || 0,
        weared: userItem.item.weared || 0,
        imageUrl: resolveImageUrl(userItem.item.image_url),
        createdAt: new Date(userItem.item.created_at),
      }
  })),
  referralsCount,
  createdAt: new Date(user.created_at),
  updatedAt: new Date(user.updated_at),
});

// Helper function to transform Supabase item to our Item type
const transformItem = (item: Tables<'items'>): Item => ({
  id: item.id,
  type: item.type as ItemType,
  tier: item.tier as ItemTier,
  name: item.name,
  price: item.price,
  coolness: item.coolness || 0,
  weared: item.weared || 0,
  imageUrl: resolveImageUrl(item.image_url),
  createdAt: new Date(item.created_at),
});

export const userApi = {
  createUser: async (telegramUser: any): Promise<User> => {
    const userData = {
      telegram_id: telegramUser.id.toString(),
      username: telegramUser.username || null,
      first_name: telegramUser.firstName || null,
      last_name: telegramUser.lastName || null,
    };

    console.log('Creating user with data:', userData);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert(userData)
      .select(`
        *,
        user_items(
          *,
          item:items(*)
        )
      `)
      .single();

    if (error) throw error;

    return transformUser(newUser, newUser.user_items || [], 0);
  },

  getUserByTelegramId: async (telegramId: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        user_items(
          *,
          item:items(*)
        )
      `)
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (error) throw error;
    if (!user) throw new Error('USER_NOT_FOUND');

    // Get referrals count
    const { count: referralsCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', user.id);

    return transformUser(user, user.user_items || [], referralsCount || 0);
  },

  purchaseItem: async (itemId: string): Promise<void> => {
    const telegramUser = initData.user();

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramUser?.id.toString() || '')
      .single();

    if (!user) throw new Error('User not found');

    // Check if user already owns this item
    const { data: existingItem } = await supabase
      .from('user_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existingItem) {
      throw new Error('Item already owned');
    }

    // Add item to user
    const { error } = await supabase
      .from('user_items')
      .insert({
        user_id: user.id,
        item_id: itemId,
        equipped: true
      });

    if (error) throw error;
  }
};

export const itemsApi = {
  getAll: async (): Promise<Item[]> => {
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('type')
      .order('tier')
      .order('price', { ascending: true });

    if (error) throw error;
    return items.map(transformItem);
  },

  getByType: async (type: string): Promise<Item[]> => {
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .eq('type', type.toUpperCase())
      .order('tier')
      .order('price', { ascending: true });

    if (error) throw error;
    return items.map(transformItem);
  }
};

export const paymentsApi = {
  // Создать инвойс для оплаты через Edge Function
  createPaymentInvoice: async (userId: string, telegramId: string, userName: string, itemId: string, itemName: string, amount: number): Promise<{ invoice_url: string; payload: string }> => {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        user_id: userId,
        telegram_id: telegramId,
        user_name: userName,
        item_id: itemId,
        item_name: itemName,
        amount: amount,
        currency: 'XTR'
      }
    });

    if (error) throw error;

    return data;
  },

  // Записать покупку после подтверждения Telegram
  recordPurchase: async (userId: string, itemId: string, payload: string, totalAmount: number = 0): Promise<void> => {
    // Сначала проверяем, есть ли уже этот айтем
    const { data: existingItem } = await supabase
      .from('user_items')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existingItem) {
      console.log('Item already owned');
      return; // Айтем уже есть, ничего не делаем
    }

    // Записываем платёж
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        telegram_payment_charge_id: payload,
        total_amount: totalAmount,
        currency: 'XTR',
        item_id: itemId,
        status: 'paid'
      });

    if (paymentError) {
      console.log('Payment record error (ignored):', paymentError.message);
      // Игнорируем ошибку записи платежа (может быть дублирование)
    }

    // Записываем айтем пользователю
    const { error: itemError } = await supabase
      .from('user_items')
      .insert({
        user_id: userId,
        item_id: itemId,
        equipped: false
      });

    if (itemError) {
      console.error('Failed to grant item:', itemError);
      throw new Error('Не удалось добавить предмет в гардероб');
    }
  },

  createPayment: async (itemId: string): Promise<PaymentData> => {
    const telegramUser = initData.user();

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramUser?.id.toString() || '')
      .single();

    if (!user) throw new Error('User not found');

    const { data: item } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Item not found');

    // Check if user already owns this item
    const { data: existingUserItem } = await supabase
      .from('user_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existingUserItem) {
      throw new Error('Item already owned');
    }

    // Create payload for payment
    const payload = JSON.stringify({
      userId: user.id,
      itemId: item.id,
      timestamp: Date.now()
    });

    // Return payment data for Telegram Web App
    return {
      title: item.name,
      description: `Покупка: ${item.name} (${item.tier})`,
      prices: [{ label: item.name, amount: item.price }],
      payload,
      currency: 'XTR'
    };
  },

  handleSuccessfulPayment: async (
    telegramPaymentChargeId: string,
    providerPaymentChargeId: string | null,
    invoicePayload: string,
    totalAmount: number,
    currency: string
  ): Promise<void> => {
    // Parse payload
    const payloadData = JSON.parse(invoicePayload);
    const { userId, itemId } = payloadData;

    // Check if payment already processed
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('telegram_payment_charge_id', telegramPaymentChargeId)
      .single();

    if (existingPayment) {
      return; // Already processed
    }

    // Save payment
    await supabase
      .from('payments')
      .insert({
        user_id: userId,
        telegram_payment_charge_id: telegramPaymentChargeId,
        provider_payment_charge_id: providerPaymentChargeId,
        total_amount: totalAmount,
        currency,
        item_id: itemId,
        status: 'completed'
      });

    // Give item to user
    await userApi.purchaseItem(itemId);
  }
};

export const starsApi = {
  purchaseWithStars: async (itemId: string): Promise<void> => {
    const telegramUser = initData.user();
    const telegramId = telegramUser?.id?.toString() || '';
    if (!telegramId) throw new Error('Не удалось определить Telegram ID');

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, stars')
      .eq('telegram_id', telegramId)
      .single();
    if (userError || !user) throw new Error('Пользователь не найден');

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, type, price')
      .eq('id', itemId)
      .single();
    if (itemError || !item) throw new Error('Предмет не найден');

    const { data: existingUserItem } = await supabase
      .from('user_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .maybeSingle();
    if (existingUserItem) throw new Error('У вас уже есть этот предмет');

    if ((user.stars || 0) < item.price) {
      throw new Error(`Недостаточно звёзд. Нужно ${item.price} ⭐`);
    }

    const { error: insertError } = await supabase
      .from('user_items')
      .insert({
        user_id: user.id,
        item_id: item.id,
        equipped: false,
      });
    if (insertError) throw insertError;

    const { error: updateStarsError } = await supabase
      .from('users')
      .update({ stars: (user.stars || 0) - item.price })
      .eq('id', user.id);
    if (updateStarsError) throw updateStarsError;
  },
};

// Надеть вещь (снять все старые этого типа и надеть новую)
export const wearItem = async (itemId: string): Promise<void> => {
  const telegramUser = initData.user();

  // Получаем пользователя
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUser?.id.toString() || '')
    .single();
  if (!user) throw new Error('User not found');

  // Получаем инфу о предмете
  const { data: item } = await supabase
    .from('items')
    .select('type')
    .eq('id', itemId)
    .single();
  if (!item) throw new Error('Item not found');

  // Проверяем, есть ли этот предмет у пользователя
  const { data: userItem } = await supabase
    .from('user_items')
    .select('id, equipped')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .single();
    
  if (!userItem) {
    throw new Error('У вас нет этого предмета');
  }

  // Сначала получаем все предметы этого типа
  const { data: itemsOfType } = await supabase
    .from('items')
    .select('id')
    .eq('type', item.type);

  if (itemsOfType && itemsOfType.length > 0) {
    const itemIds = itemsOfType.map(i => i.id);
    
    // Снимаем все вещи этого типа
    const { error: unequipError } = await supabase
      .from('user_items')
      .update({ equipped: false })
      .eq('user_id', user.id)
      .in('item_id', itemIds);
    
    if (unequipError) {
      console.error('❌ [API] Ошибка при снятии предметов:', unequipError);
      throw new Error('Ошибка при снятии старых предметов');
    }
  }

  const { error } = await supabase
    .from('user_items')
    .update({ equipped: true })
    .eq('user_id', user.id)
    .eq('item_id', itemId);
    
  
  if (error) {
    console.error('❌ [API] Ошибка при надевании:', error);
    throw error;
  }
  
  // Финальная проверка
  const { data: finalCheck } = await supabase
    .from('user_items')
    .select('equipped')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .single();
  
  if (!finalCheck?.equipped) {
    console.error('❌ [API] ВНИМАНИЕ: Предмет не надет после операции!');
    throw new Error('Не удалось надеть предмет');
  }
};

// Функция для подготовки inline сообщения через Edge Function
export const prepareShareMessage = async (): Promise<string> => {
  const telegramUser = initData.user();

  // Получаем ID пользователя
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUser?.id.toString() || '')
    .single();

  if (!user) throw new Error('User not found');

  // Вызываем Edge Function для подготовки сообщения
  const { data, error } = await supabase.functions.invoke('prepare-share-message', {
    body: {
      user_id: user.id
    }
  });

  if (error) {
    console.error('prepareShareMessage error:', error);
    throw new Error(`Не удалось подготовить сообщение: ${error.message}`);
  }

  return data.prepared_message_id;
};

export const claimChannelReward = async (channelUrl: string): Promise<{ message: string; stars_added: number; already_claimed: boolean }> => {
  const telegramUser = initData.user();
  if (!telegramUser?.id) {
    throw new Error('Не удалось определить Telegram ID');
  }

  const { data, error } = await supabase.functions.invoke('claim-channel-reward', {
    body: {
      telegram_id: telegramUser.id.toString(),
      username: telegramUser.username || null,
      first_name: (telegramUser as any).firstName || (telegramUser as any).first_name || null,
      last_name: (telegramUser as any).lastName || (telegramUser as any).last_name || null,
      channel_url: channelUrl,
    },
  });

  if (error) {
    const message = error.message || '';
    if (message.includes('Failed to send a request to the Edge Function')) {
      throw new Error('Сервер наград недоступен. Проверь, что Edge Function claim-channel-reward задеплоена в Supabase.');
    }
    throw new Error(message || 'Не удалось получить награду');
  }

  if (!data?.success) {
    const errorMessage = data?.error || data?.message || 'Не удалось получить награду';
    if (String(errorMessage).includes('Add bot to channel admin list')) {
      throw new Error('Бот не имеет доступа к каналу. Добавь бота в админы канала и повтори.');
    }
    throw new Error(errorMessage);
  }

  return {
    message: data.message || 'Награда получена',
    stars_added: data.stars_added || 0,
    already_claimed: !!data.already_claimed,
  };
};

export const economyApi = {
  updateStarsByUserId: async (userId: string, nextStars: number): Promise<void> => {
    const { error } = await supabase
      .from('users')
      .update({ stars: nextStars })
      .eq('id', userId);

    if (error) throw error;
  },
};

export const workApi = {
  getWorkCards: async (): Promise<WorkCardModel[]> => {
    const { data, error } = await supabase
      .from('work_cards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return (data || []).map((card) => ({
      id: card.id,
      code: card.code,
      title: card.title,
      description: card.description,
      unlockPrice: card.unlock_price,
      profitPerHour: card.profit_per_hour,
      imageUrl: resolveImageUrl(card.image_url),
    }));
  },

  getUserWorks: async (telegramId: string): Promise<UserWorkModel[]> => {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (userError || !user) throw new Error('Пользователь не найден');

    const { data, error } = await supabase
      .from('user_work_cards')
      .select('id, work_card_id, purchased_at, last_claim_at, total_earned')
      .eq('user_id', user.id);

    if (error) throw error;

    return (data || []).map((entry) => ({
      id: entry.id,
      workCardId: entry.work_card_id,
      purchasedAt: new Date(entry.purchased_at).getTime(),
      lastClaimAt: new Date(entry.last_claim_at).getTime(),
      totalEarned: entry.total_earned || 0,
    }));
  },

  purchaseWork: async (workCardId: string): Promise<void> => {
    const telegramUser = initData.user();
    const telegramId = telegramUser?.id?.toString() || '';
    if (!telegramId) throw new Error('Не удалось определить Telegram ID');

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, stars')
      .eq('telegram_id', telegramId)
      .single();
    if (userError || !user) throw new Error('Пользователь не найден');

    const { data: card, error: cardError } = await supabase
      .from('work_cards')
      .select('id, unlock_price, is_active')
      .eq('id', workCardId)
      .maybeSingle();
    if (cardError || !card || !card.is_active) throw new Error('Работа не найдена');

    const { data: existing } = await supabase
      .from('user_work_cards')
      .select('id')
      .eq('user_id', user.id)
      .eq('work_card_id', card.id)
      .maybeSingle();
    if (existing) throw new Error('Эта работа уже куплена');

    if ((user.stars || 0) < card.unlock_price) {
      throw new Error(`Недостаточно звёзд. Нужно ${card.unlock_price} ⭐`);
    }

    const { error: insertError } = await supabase
      .from('user_work_cards')
      .insert({ user_id: user.id, work_card_id: card.id });
    if (insertError) throw insertError;

    const { error: updateStarsError } = await supabase
      .from('users')
      .update({ stars: (user.stars || 0) - card.unlock_price })
      .eq('id', user.id);
    if (updateStarsError) throw updateStarsError;
  },

  claimIncome: async (workCardId: string): Promise<number> => {
    const telegramUser = initData.user();
    const telegramId = telegramUser?.id?.toString() || '';
    if (!telegramId) throw new Error('Не удалось определить Telegram ID');

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, stars')
      .eq('telegram_id', telegramId)
      .single();
    if (userError || !user) throw new Error('Пользователь не найден');

    const { data: card, error: cardError } = await supabase
      .from('work_cards')
      .select('id, profit_per_hour, is_active')
      .eq('id', workCardId)
      .maybeSingle();
    if (cardError || !card || !card.is_active) throw new Error('Работа не найдена');

    const { data: userWork, error: userWorkError } = await supabase
      .from('user_work_cards')
      .select('id, last_claim_at, total_earned')
      .eq('user_id', user.id)
      .eq('work_card_id', card.id)
      .maybeSingle();
    if (userWorkError || !userWork) throw new Error('Работа не куплена');

    const now = Date.now();
    const lastClaim = new Date(userWork.last_claim_at).getTime();
    const elapsedHours = Math.max(0, (now - lastClaim) / 3600000);
    const earned = Math.floor(elapsedHours * card.profit_per_hour);
    if (earned <= 0) throw new Error('Пока не накопилось звёзд');

    const { error: updateWorkError } = await supabase
      .from('user_work_cards')
      .update({
        last_claim_at: new Date(now).toISOString(),
        total_earned: (userWork.total_earned || 0) + earned,
      })
      .eq('id', userWork.id);
    if (updateWorkError) throw updateWorkError;

    const { error: updateStarsError } = await supabase
      .from('users')
      .update({ stars: (user.stars || 0) + earned })
      .eq('id', user.id);
    if (updateStarsError) throw updateStarsError;

    return earned;
  },
};

export const starsTransferApi = {
  transferByTelegramId: async (recipientTelegramId: string, amount: number, note?: string): Promise<{ sender_stars: number; recipient_stars: number }> => {
    const telegramUser = initData.user();
    const senderTelegramId = telegramUser?.id?.toString() || '';
    if (!senderTelegramId) throw new Error('Не удалось определить ваш Telegram ID');

    const cleanRecipient = String(recipientTelegramId || '').trim();
    if (!cleanRecipient) throw new Error('Укажите Telegram ID получателя');
    if (!/^\d+$/.test(cleanRecipient)) throw new Error('Telegram ID получателя должен содержать только цифры');

    const starsAmount = Number(amount);
    if (!Number.isFinite(starsAmount) || starsAmount <= 0) {
      throw new Error('Сумма перевода должна быть больше 0');
    }

    const { data, error } = await supabase.rpc('transfer_stars', {
      p_sender_telegram_id: senderTelegramId,
      p_recipient_telegram_id: cleanRecipient,
      p_amount: Math.floor(starsAmount),
      p_note: note?.trim() || null,
    });

    if (error) {
      const message = String(error.message || '');
      if (message.includes('RECIPIENT_NOT_FOUND')) throw new Error('Получатель не найден');
      if (message.includes('SENDER_NOT_FOUND')) throw new Error('Отправитель не найден');
      if (message.includes('CANNOT_TRANSFER_TO_SELF')) throw new Error('Нельзя отправить звёзды самому себе');
      if (message.includes('INSUFFICIENT_STARS')) throw new Error('Недостаточно звёзд для перевода');
      if (message.includes('INVALID_TRANSFER_AMOUNT')) throw new Error('Некорректная сумма перевода');
      throw new Error(error.message || 'Не удалось выполнить перевод');
    }

    return {
      sender_stars: data?.sender_stars ?? 0,
      recipient_stars: data?.recipient_stars ?? 0,
    };
  },
};
