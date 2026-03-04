import { create } from 'zustand';
import { Item, ItemType } from '../types';
import { itemsApi } from '../services/api';

interface ItemsState {
  items: Item[];
  loading: boolean;
  error: string | null;
  selectedType: ItemType | null;
  fetchItems: () => Promise<void>;
  fetchItemsByType: (type: ItemType) => Promise<void>;
  setSelectedType: (type: ItemType | null) => void;
  clearError: () => void;
}

export const useItemsStore = create<ItemsState>((set) => ({
  items: [],
  loading: false,
  error: null,
  selectedType: null,

  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const items = await itemsApi.getAll();
      set({ items, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Не удалось загрузить предметы',
        loading: false 
      });
    }
  },

  fetchItemsByType: async (type: ItemType) => {
    set({ loading: true, error: null });
    try {
      const items = await itemsApi.getByType(type);
      set({ items, loading: false, selectedType: type });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Не удалось загрузить предметы',
        loading: false 
      });
    }
  },

  setSelectedType: (type: ItemType | null) => {
    set({ selectedType: type });
  },

  clearError: () => {
    set({ error: null });
  }
}));
