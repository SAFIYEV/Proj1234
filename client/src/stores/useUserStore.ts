import { create } from 'zustand';
import { User } from '../types';
import { userApi } from '../services/api';
import { initData } from '@telegram-apps/sdk-react';

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  fetchUser: (telegramId: string) => Promise<void>;
  createUser: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  error: null,

  fetchUser: async (telegramId: string) => {
    set({ loading: true, error: null });
    try {
      const user = await userApi.getUserByTelegramId(telegramId);
      set({ user, loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Не удалось загрузить пользователя',
        loading: false 
      });
    }
  },

  createUser: async () => {
    set({ loading: true, error: null });
    try {
      const telegramUser = initData.user();
      if (!telegramUser) {
        throw new Error('Данные пользователя Telegram недоступны');
      }
      
      console.log('Creating new user:', telegramUser);
      const newUser = await userApi.createUser(telegramUser);
      set({ user: newUser, loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Не удалось создать пользователя',
        loading: false 
      });
    }
  },

  updateUser: (user: User) => {
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  }
}));
