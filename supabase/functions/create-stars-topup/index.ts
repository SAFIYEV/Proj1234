import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, telegram_id, amount } = await req.json()

    const starsAmount = Math.max(1, Number.parseInt(String(amount), 10) || 0)
    if (!user_id || !telegram_id || !starsAmount) {
      throw new Error('Missing required fields')
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured')
    }

    const invoiceData = {
      title: 'Пополнение баланса ⭐',
      description: `Пополнение баланса на ${starsAmount} ⭐`,
      payload: `odenpashu_topup_${user_id}_${starsAmount}_${Date.now()}`,
      currency: 'XTR',
      prices: [{ label: 'Пополнение баланса', amount: starsAmount }],
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    })

    const result = await response.json()
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`)
    }

    return new Response(JSON.stringify({
      invoice_url: result.result,
      payload: invoiceData.payload,
      amount: starsAmount,
      user_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
