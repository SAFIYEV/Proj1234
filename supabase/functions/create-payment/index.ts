import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, telegram_id, user_name, item_id, item_name, amount, currency } = await req.json()

    if (!telegram_id || !item_id || !item_name || !amount) {
      throw new Error('Missing required fields')
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured')
    }

    const invoiceData = {
      title: `Покупка: ${item_name}`,
      description: `Купите ${item_name} за ${amount} звёзд`,
      payload: `odenpashu_${user_id}_${item_id}_${Date.now()}`,
      currency: currency || 'XTR',
      prices: [{ label: `${item_name}`, amount: amount }]
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    })

    const result = await response.json()

    if (result.ok) {
      return new Response(JSON.stringify({ 
        invoice_url: result.result,
        payload: invoiceData.payload,
        item_id,
        user_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.error('Telegram API error:', result)
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
