import { createClient } from '@supabase/supabase-js';
import { initData } from '@telegram-apps/sdk-react';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          telegram_id: string
          username: string | null
          first_name: string | null
          last_name: string | null
          stars: number
          referral_code: string
          referred_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          telegram_id: string
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          stars?: number
          referral_code?: string
          referred_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          telegram_id?: string
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          stars?: number
          referral_code?: string
          referred_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          type: 'UNDERWEAR' | 'SOCKS' | 'SHOES' | 'PANTS' | 'RING' | 'SHIRT' | 'NECKLACE' | 'GLASSES' | 'CAP'
          tier: 'POOR' | 'WORKER' | 'RICH' | 'JEW'
          name: string
          price: number
          coolness: number | null
          weared: number | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: 'UNDERWEAR' | 'SOCKS' | 'SHOES' | 'PANTS' | 'RING' | 'SHIRT' | 'NECKLACE' | 'GLASSES' | 'CAP'
          tier: 'POOR' | 'WORKER' | 'RICH' | 'JEW'
          name: string
          price: number
          coolness?: number | null
          weared?: number | null
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'UNDERWEAR' | 'SOCKS' | 'SHOES' | 'PANTS' | 'RING' | 'SHIRT' | 'NECKLACE' | 'GLASSES' | 'CAP'
          tier?: 'POOR' | 'WORKER' | 'RICH'
          name?: string
          price?: number
          coolness?: number | null
          weared?: number | null
          image_url?: string | null
          created_at?: string
        }
      }
      user_items: {
        Row: {
          id: string
          user_id: string
          item_id: string
          equipped: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_id: string
          equipped?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          item_id?: string
          equipped?: boolean
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          telegram_payment_charge_id: string
          provider_payment_charge_id: string | null
          total_amount: number
          currency: string
          item_id: string | null
          status: string
          created_at: string
          updated_at: string
          telegram_id: string | null
          payload: string | null
        }
        Insert: {
          id?: string
          user_id: string
          telegram_payment_charge_id: string
          provider_payment_charge_id?: string | null
          total_amount: number
          currency?: string
          item_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          telegram_id?: string | null
          payload?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          telegram_payment_charge_id?: string
          provider_payment_charge_id?: string | null
          total_amount?: number
          currency?: string
          item_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          telegram_id?: string | null
          payload?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      item_type: 'UNDERWEAR' | 'SOCKS' | 'SHOES' | 'PANTS' | 'RING' | 'SHIRT' | 'NECKLACE' | 'GLASSES' | 'CAP'
      item_tier: 'POOR' | 'WORKER' | 'RICH' | 'JEW'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Telegram Web Apps don't need session persistence
  },
  global: {
    headers: {
      'x-telegram-init-data': initData.raw() || '',
    },
  },
});

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
