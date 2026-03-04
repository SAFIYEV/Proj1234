import { supabase, Tables } from '../lib/supabase';
import { initData } from '@telegram-apps/sdk-react';
import { User, Item, PaymentData, ItemType, ItemTier } from '../types';

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
        imageUrl: userItem.item.image_url || undefined,
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
  imageUrl: item.image_url || undefined,
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
      .single();

    if (error) throw error;

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
      .single();

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
      .single();

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
      .single();

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
