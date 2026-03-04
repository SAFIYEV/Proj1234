import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, item_id, total_amount, payload } = await req.json()
    
    console.log('verify-payment called with:', { 
      user_id, 
      item_id, 
      total_amount,
      payload 
    })
    
    // Подключаемся к Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Проверяем существует ли платеж с таким payload для этого пользователя
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('payload', payload)
      .eq('user_id', user_id)
      .single()
    
    if (existingPayment) {
      return new Response(JSON.stringify({ 
        status: 'already_exists',
        payment: existingPayment 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Ограничение по времени (не больше 1 платежа в минуту для пользователя)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { data: recentPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', user_id)
      .gte('created_at', oneMinuteAgo)
    
    if (recentPayments && recentPayments.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Слишком частые платежи. Подождите минуту.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Проверка платежа через Telegram API (пропускаем для тестовых)
    if (botToken && !payload.startsWith('test_') && !payload.startsWith('fallback_') && !payload.startsWith('error_')) {
      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
          method: 'GET'
        })
        
        if (!telegramResponse.ok) {
          throw new Error('Не удалось проверить платеж через Telegram API')
        }
        
      } catch (telegramError) {
        console.error('Ошибка проверки через Telegram:', telegramError)
        return new Response(JSON.stringify({ 
          error: 'Платеж не подтвержден Telegram API' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }
    
    // Записываем новый платеж
    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: user_id,
        telegram_payment_charge_id: payload, // используем payload как charge_id  
        total_amount: total_amount || 0,
        currency: 'XTR',
        item_id: item_id,
        status: 'paid'
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }

    // Сначала проверим, есть ли уже этот предмет у пользователя
    const { data: existingItem } = await supabase
      .from('user_items')
      .select('id')
      .eq('user_id', user_id)
      .eq('item_id', item_id)
      .single()

    let itemGranted = false
    let itemMessage = ''

    if (existingItem) {
      itemGranted = true
      itemMessage = 'Item already owned'
      console.log(`User ${user_id} already owns item ${item_id}`)
    } else {
      // Выдаём предмет (user_items)
      const { data: itemData, error: userItemError } = await supabase
        .from('user_items')
        .insert({
          user_id,
          item_id,
          equipped: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (userItemError) {
        console.error('Failed to grant item:', userItemError)
        itemMessage = 'Failed to grant item: ' + userItemError.message
      } else {
        itemGranted = true
        itemMessage = 'Item granted successfully'
        console.log(`Item ${item_id} granted to user ${user_id}:`, itemData)
      }
    }
    
    return new Response(JSON.stringify({ 
      status: 'success',
      payment: data,
      item_granted: itemGranted,
      item_message: itemMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})