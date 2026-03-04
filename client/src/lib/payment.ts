import { supabase } from './supabase';
import { Item, User } from '../types';

// Типы для работы с платежами
export interface PaymentInvoice {
  invoice_url: string;
  payload: string;
  item_id: string;
  user_id: string;
}

export interface PaymentResult {
  status: 'success' | 'already_exists' | 'error';
  payment?: any;
  error?: string;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  invoice_url?: string;
}

// Интерфейс для работы с платежами
export interface IPaymentProvider {
  createInvoice(user: User, item: Item): Promise<PaymentInvoice>;
  verifyPayment(user_id: string, payment_charge_id: string, item_id: string, amount: number): Promise<PaymentResult>;
  purchaseItem(user: User, item: Item): Promise<PurchaseResult>;
}

// Реализация через Supabase Edge Functions
class SupabasePaymentProvider implements IPaymentProvider {
  private getFunctionsUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return supabaseUrl.replace('supabase.co', 'functions.supabase.co');
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };
  }

  async createInvoice(_user: User, item: Item): Promise<PaymentInvoice> {
    
    const response = await fetch(`${this.getFunctionsUrl()}/create-payment`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        user_id: _user.id,
        telegram_id: _user.telegramId,
        user_name: _user.username || _user.firstName || '',
        item_id: item.id,
        item_name: item.name,
        amount: item.price,
        currency: 'XTR',
      }),
    });

    if (!response.ok) {
      throw new Error(`Создание платежа недоступно: ${response.status}`);
    }

    const data = await response.json();
    if (!data.invoice_url) {
      throw new Error(data.error || 'Ошибка создания платежа');
    }

    return data;
  }

  async verifyPayment(_user_id: string, _payment_charge_id: string, _item_id: string, _amount: number): Promise<PaymentResult> {
    const response = await fetch(`${this.getFunctionsUrl()}/verify-payment`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        user_id: _user_id,
        telegram_payment_charge_id: _payment_charge_id,
        item_id: _item_id,
        total_amount: _amount,
        currency: 'XTR',
      }),
    });

    if (!response.ok) {
      throw new Error(`Подтверждение платежа недоступно: ${response.status}`);
    }

    return await response.json();
  }

  async purchaseItem(user: User, item: Item): Promise<PurchaseResult> {
    try {
      // Проверяем наличие предмета
      const hasItem = user.items.some(userItem => userItem.itemId === item.id);
      if (hasItem) {
        return { success: false, message: 'У вас уже есть этот предмет!' };
      }

      // Создаём инвойс
      const invoice = await this.createInvoice(user, item);
      
      // Возвращаем данные для ручной обработки
      return { 
        success: true, 
        message: 'Инвойс создан', 
        invoice_url: invoice.invoice_url 
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Ошибка при покупке' };
    }
  }
}

// Реализация через прямую работу с Supabase (fallback)
class DirectSupabaseProvider implements IPaymentProvider {
  async createInvoice(_user: User, _item: Item): Promise<PaymentInvoice> {
    throw new Error('Direct Supabase provider не поддерживает создание инвойсов');
  }

  async verifyPayment(_user_id: string, _payment_charge_id: string, _item_id: string, _amount: number): Promise<PaymentResult> {
    throw new Error('Direct Supabase provider не поддерживает верификацию платежей');
  }

  async purchaseItem(user: User, item: Item): Promise<PurchaseResult> {
    try {
      const hasItem = user.items.some(userItem => userItem.itemId === item.id);
      if (hasItem) {
        return { success: false, message: 'У вас уже есть этот предмет!' };
      }

      // Прямое добавление предмета без оплаты (для тестирования)
      const { error } = await supabase
        .from('user_items')
        .insert({
          user_id: user.id,
          item_id: item.id,
          equipped: false,
        });

      if (error) throw error;

      return { success: true, message: 'Предмет добавлен бесплатно (тестовый режим)' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Ошибка при добавлении предмета' };
    }
  }
}

// Фабрика для создания провайдера
class PaymentProviderFactory {
  static create(): IPaymentProvider {
    // В зависимости от конфигурации возвращаем нужный провайдер
    const useEdgeFunctions = import.meta.env.VITE_USE_EDGE_FUNCTIONS !== 'false';
    
    if (useEdgeFunctions) {
      return new SupabasePaymentProvider();
    } else {
      return new DirectSupabaseProvider();
    }
  }
}

// Экспортируем готовый экземпляр
export const paymentProvider = PaymentProviderFactory.create();

// Utility функции
export const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}М`;
  } else if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}К`;
  }
  return `${price}`;
};

export const checkItemOwnership = (user: User, item: Item): boolean => {
  return user.items.some(userItem => userItem.itemId === item.id);
};
