import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Простые CORS заголовки
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
  // Разрешаем CORS и OPTIONS запросы
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const update = await req.json()
    console.log('Telegram webhook update:', JSON.stringify(update, null, 2))
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured')
    }

    // Обрабатываем pre_checkout_query - подтверждаем платеж
    if (update.pre_checkout_query) {
        const preCheckoutQuery = update.pre_checkout_query
        console.log('Pre-checkout query:', preCheckoutQuery)

        // Подтверждаем платеж
        const response = await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pre_checkout_query_id: preCheckoutQuery.id,
                ok: true
            })
            })

            const result = await response.json()
            console.log('answerPreCheckoutQuery result:', result)

            // СРАЗУ записываем платёж и выдаём предмет (без ожидания successful_payment)
            try {
                const payload: string = preCheckoutQuery.invoice_payload || ''
                let itemId: string | null = null
                let userUuid: string | null = null
                const isTopupPayload = payload.startsWith('odenpashu_topup_')

                if (!isTopupPayload && payload.startsWith('odenpashu_')) {
                    const parts = payload.split('_')
                    if (parts.length >= 4) {
                    userUuid = parts[1]
                    itemId = parts[2]
                    }
                }

                if (userUuid && itemId) {
                    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                    const supabase = createClient(supabaseUrl, supabaseKey)

                    // Получаем инфу о предмете, чтобы узнать type и tier
                    const { data: item, error: itemInfoErr } = await supabase
                      .from('items')
                      .select('type')
                      .eq('id', itemId)
                      .single()
                    if (itemInfoErr || !item) {
                      console.error('Не удалось получить инфу о предмете:', itemInfoErr)
                    } else {
                      // Снимаем все шмотки этого типа (и тира) у пользователя
                      const { error: unequipErr } = await supabase
                        .from('user_items')
                        .update({ equipped: false })
                        .eq('user_id', userUuid)
                        .in('item_id',
                          (
                            await supabase
                              .from('items')
                              .select('id')
                              .eq('type', item.type)
                          ).data?.map(i => i.id) || []
                        )
                      if (unequipErr) {
                        console.error('Ошибка при снятии старых шмоток:', unequipErr)
                      }
                    }
                    // Пишем платеж как предварительно подтвержденный
                    const { error: paymentErr } = await supabase
                    .from('payments')
                    .insert({
                        user_id: userUuid,
                        item_id: itemId,
                        total_amount: preCheckoutQuery.total_amount || 0,
                        currency: preCheckoutQuery.currency || 'XTR',
                        payload: payload,
                        telegram_id: String(preCheckoutQuery.from?.id || ''),
                        status: 'pre_checkout'
                    })

                    if (paymentErr) {
                    console.log('payment insert (pre_checkout) error:', paymentErr.message)
                    }

                    // Выдаём предмет пользователю (игнорируем дубликаты)
                    const { error: itemErr } = await supabase
                    .from('user_items')
                    .upsert({ user_id: userUuid, item_id: itemId, equipped: true }, { onConflict: ['user_id', 'item_id'] })

                    if (itemErr && itemErr.code !== '23505') {
                    console.error('grant item error:', itemErr)
                    } else if (!itemErr) {
                    console.log(`Item ${itemId} granted to user ${userUuid} (pre_checkout)`)
                    }
                } else {
                    console.log('pre_checkout payload parse failed:', payload)
                }
            } catch (e) {
            console.error('post-pre_checkout db ops failed:', e)
            }

      return new Response(JSON.stringify({ status: 'pre_checkout_confirmed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // successful_payment: начисление пополнения баланса в звёздах
    if (update.message?.successful_payment) {
      const message = update.message
      const payment = message.successful_payment
      const payload: string = payment.invoice_payload || ''

      if (payload.startsWith('odenpashu_topup_')) {
        const parts = payload.split('_')
        const userUuid = parts.length >= 4 ? parts[2] : null
        const amountFromPayload = parts.length >= 4 ? Number.parseInt(parts[3], 10) : 0

        if (!userUuid) {
          throw new Error('Topup payload parse failed')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const telegramChargeId = payment.telegram_payment_charge_id || payload

        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('telegram_payment_charge_id', telegramChargeId)
          .maybeSingle()

        if (existingPayment) {
          return new Response(JSON.stringify({ status: 'topup_already_processed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const creditedStars = Math.max(
          1,
          Number.parseInt(String(payment.total_amount ?? amountFromPayload), 10) || amountFromPayload || 0
        )

        const { error: paymentErr } = await supabase
          .from('payments')
          .insert({
            user_id: userUuid,
            telegram_payment_charge_id: telegramChargeId,
            provider_payment_charge_id: payment.provider_payment_charge_id || null,
            total_amount: creditedStars,
            currency: payment.currency || 'XTR',
            item_id: null,
            status: 'paid',
            payload,
            telegram_id: String(message.from?.id || ''),
          })

        if (paymentErr) {
          throw new Error(`Topup payment insert failed: ${paymentErr.message}`)
        }

        const { error: starsErr } = await supabase.rpc('increment_user_stars', {
          p_user_id: userUuid,
          p_stars_delta: creditedStars,
        })

        if (starsErr) {
          // Fallback for projects without increment_user_stars function
          const { data: currentUser, error: currentErr } = await supabase
            .from('users')
            .select('stars')
            .eq('id', userUuid)
            .single()

          if (currentErr || !currentUser) {
            throw new Error(`Topup user fetch failed: ${currentErr?.message || 'user not found'}`)
          }

          const { error: updateErr } = await supabase
            .from('users')
            .update({ stars: (currentUser.stars || 0) + creditedStars })
            .eq('id', userUuid)

          if (updateErr) {
            throw new Error(`Topup stars update failed: ${updateErr.message}`)
          }
        }

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: `Баланс пополнен на +${creditedStars} ⭐`,
          })
        })

        return new Response(JSON.stringify({ status: 'topup_processed', stars_added: creditedStars }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }


    // Обработка команды /start и inline-запросов
    if (update.message && update.message.text) {
      const message = update.message
      const text = message.text
      const chat_id = message.chat.id
      const from = message.from
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Проверяем /start
      if (text.startsWith('/start')) {
        // Парсим реферальный payload (если есть)
        let referred_by: string | null = null
        const parts = text.split(' ')
        if (parts.length > 1) {
          referred_by = parts[1] // ожидаем referral_code
        }
        // Проверяем, есть ли пользователь
        let { data: user, error: userErr } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_id', String(from.id))
          .single()
        let user_id = null
        if (!user) {
          // Если нет — создаём
          let insertData: any = {
            telegram_id: String(from.id),
            username: from.username || null,
            first_name: from.first_name || null,
            last_name: from.last_name || null
          }
          if (referred_by) {
            // Ищем id пригласившего по referral_code
            const { data: refUser } = await supabase
              .from('users')
              .select('id')
              .eq('referral_code', referred_by)
              .single()
            if (refUser) {
              insertData.referred_by = refUser.id
            }
          }
          const { data: newUser, error: insErr } = await supabase
            .from('users')
            .insert(insertData)
            .select('*')
            .single()
          user = newUser
          user_id = newUser?.id
        } else {
          user_id = user.id
        }
        // Получаем свою реферальную ссылку
        let referral_code = user?.referral_code
        if (!referral_code) {
          // Если вдруг нет — обновим
          const { data: updated, error: updErr } = await supabase
            .from('users')
            .update({ referral_code: crypto.randomUUID() })
            .eq('id', user_id)
            .select('referral_code')
            .single()
          referral_code = updated?.referral_code
        }
        // Формируем реферальную ссылку
        const refLink = `https://t.me/${Deno.env.get('BOT_USERNAME')}?start=${referral_code}`
        // Отправляем приветствие
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id,
            text: `Добро пожаловать, ${from.first_name || ''}!\n\nТвоя реферальная ссылка:\n${refLink}`
          })
        })
        return new Response(JSON.stringify({ status: 'start_handled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Inline-режим (inline_query)
    if (update.inline_query) {
      const inline_query = update.inline_query
      const from = inline_query.from
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      // Получаем пользователя
      let { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', String(from.id))
        .single()
      let referral_code = user?.referral_code
      if (!referral_code) {
        // Если вдруг нет — создаём
        const { data: newUser } = await supabase
          .from('users')
          .insert({ telegram_id: String(from.id), username: from.username || null, first_name: from.first_name || null, last_name: from.last_name || null })
          .select('*')
          .single()
        referral_code = newUser?.referral_code
      }
      const tmaLink = referral_code ? `https://t.me/${Deno.env.get('BOT_USERNAME')}/play?startapp=${referral_code}` : 'https://t.me/oden_pashu_bot/play'
      // Получаем все надетые шмотки пользователя
      const { data: equippedItems } = await supabase
        .from('user_items')
        .select('item_id, equipped')
        .eq('user_id', user?.id)
        .eq('equipped', true)
      // Получаем инфу о всех шмотках
      const { data: allItems } = await supabase
        .from('items')
        .select('*')
      // Получаем все купленные шмотки пользователя
      const { data: userItems } = await supabase
        .from('user_items')
        .select('item_id')
        .eq('user_id', user?.id)
      const ownedFull = userItems && allItems ? userItems.map(ui => allItems.find(i => i.id === ui.item_id)).filter(Boolean) : []
      // Сопоставляем надетые шмотки с их инфой
      const equippedFull = equippedItems && allItems ? equippedItems.map(ui => allItems.find(i => i.id === ui.item_id)).filter(Boolean) : []
      // Считаем крутость и степень одетости
      const totalCoolness = equippedFull.reduce((acc, it) => acc + (it.coolness || 0), 0)
      const totalWeared = equippedFull.reduce((acc, it) => acc + (it.weared || 0), 0)
      // Считаем общую стоимость коллекции (все купленные)
      const totalCollectionPrice = ownedFull.reduce((acc, it) => acc + (it.price || 0), 0)
      // Находим самую дорогую шмотку среди всех купленных
      let mostExpensive = null;
      if (ownedFull.length > 0) {
        mostExpensive = ownedFull.reduce((max, it) => (it.price > (max?.price || 0) ? it : max), ownedFull[0]);
      }
      // Определяем, какие типы шмоток есть в каждом тира среди всех купленных
      const types = ['CAP','GLASSES','NECKLACE','SHIRT','RING','PANTS','UNDERWEAR','SHOES','SOCKS']
      const tiers = ['JEW','RICH','WORKER','POOR']
      let userSet = ''
      for (const tier of tiers) {
        const hasAll = types.every(type => ownedFull.find(i => i.tier === tier && i.type === type))
        if (hasAll) {
          userSet = tier
          break
        }
      }
      // Тексты и картинки по сету
      const setInfo = {
        'JEW': {
          name: 'Дубайский синагой',
          img: 'https://oden-pashu.sirv.com/avatars/jew.jpeg?t=2',
          text: `Если вы когда-нибудь интересовались, кто владеет всеми деньгами мира - это я.`,
          btn: 'Одень своего Пашу'
        },
        'RICH': {
          name: 'Мажорище',
          img: 'https://oden-pashu.sirv.com/avatars/rich.jpeg?t=2',
          text: `Денежки не проблема, сынок! 😜\n\nА ты дрочи дальше свои копейки 😂`,
          btn: 'Одень своего Пашу'
        },
        'WORKER': {
          name: 'Работяга',
          img: 'https://oden-pashu.sirv.com/avatars/worker.jpeg?t=1',
          text: `Перед вами приличный человек, на таких блокчейн держится 🫡`,
          btn: 'Одень своего Пашу'
        },
        'POOR': {
          name: 'Нищук',
          img: 'https://oden-pashu.sirv.com/avatars/poor.jpeg?t=1',
          text: `Я экономил на обедах и наконец-то можно выйти в люди! 😎\n\nА вам слабо? 🤣`,
          btn: 'Одень своего Пашу'
        },
        'BUM': {
          name: 'Бомж',
          img: 'https://oden-pashu.sirv.com/avatars/loh.jpeg?t=1',
          text: `Я такой нищий, что даже на сет Нищука не хватает! 😭`,
          btn: 'Одень своего Пашу'
        }
      }
      const setKey = userSet || 'BUM'
      const info = setInfo[setKey]
      // Готовим ответ
      const results = [
        {
          type: 'photo',
          id: 'flex',
          photo_url: info.img,
          thumb_url: info.img,
          photo_width: 512,
          photo_height: 512,
          title: 'Распушить Павлина перед чатом',
          description: 'Покажи всем, какой крутой лук ты собрал!',
          caption: `Сет: ${info.name}\n\nКрутость: ${totalCoolness}\nОдет на ${totalWeared}%\nОбщая стоимость коллекции: ${totalCollectionPrice} ⭐\n${mostExpensive ? `Самая дорогая шмотка: ${mostExpensive.name} (${mostExpensive.price} ⭐)` : ''}\n\n${info.text}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: info.btn, url: tmaLink }
              ]
            ]
          }
        }
      ]
      await fetch(`https://api.telegram.org/bot${botToken}/answerInlineQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inline_query_id: inline_query.id,
          results,
          cache_time: 0
        })
      })
      return new Response(JSON.stringify({ status: 'inline_handled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Для всех остальных обновлений просто возвращаем OK
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})