import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      throw new Error('user_id is required');
    }
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Получаем пользователя
    const { data: user, error: userErr } = await supabase.from('users').select('*').eq('id', user_id).single();
    if (userErr || !user) {
      throw new Error('User not found');
    }
    const referral_code = user.referral_code;
    const tmaLink = referral_code ? `https://t.me/${Deno.env.get('BOT_USERNAME')}/play?startapp=${referral_code}` : 'https://t.me/oden_pashu_bot/play';
    // Получаем все надетые шмотки пользователя
    const { data: equippedItems } = await supabase.from('user_items').select('item_id, equipped').eq('user_id', user.id).eq('equipped', true);
    // Получаем инфу о всех шмотках
    const { data: allItems } = await supabase.from('items').select('*');
    // Получаем все купленные шмотки пользователя
    const { data: userItems } = await supabase.from('user_items').select('item_id').eq('user_id', user.id);
    const ownedFull = userItems && allItems ? userItems.map((ui)=>allItems.find((i)=>i.id === ui.item_id)).filter(Boolean) : [];
    // Сопоставляем надетые шмотки с их инфой
    const equippedFull = equippedItems && allItems ? equippedItems.map((ui)=>allItems.find((i)=>i.id === ui.item_id)).filter(Boolean) : [];
    // Считаем крутость и степень одетости
    const totalCoolness = equippedFull.reduce((acc, it)=>acc + (it.coolness || 0), 0);
    const totalWeared = equippedFull.reduce((acc, it)=>acc + (it.weared || 0), 0);
    // Считаем общую стоимость коллекции (все купленные)
    const totalCollectionPrice = ownedFull.reduce((acc, it)=>acc + (it.price || 0), 0);
    // Находим самую дорогую шмотку среди всех купленных
    let mostExpensive = null;
    if (ownedFull.length > 0) {
      mostExpensive = ownedFull.reduce((max, it)=>it.price > (max?.price || 0) ? it : max, ownedFull[0]);
    }
    // Определяем, какие типы шмоток есть в каждом тира среди всех купленных
    const types = [
      'CAP',
      'GLASSES',
      'NECKLACE',
      'SHIRT',
      'RING',
      'PANTS',
      'UNDERWEAR',
      'SHOES',
      'SOCKS'
    ];
    const tiers = [
      'JEW',
      'RICH',
      'WORKER',
      'POOR'
    ];
    let userSet = '';
    for (const tier of tiers){
      const hasAll = types.every((type)=>ownedFull.find((i)=>i.tier === tier && i.type === type));
      if (hasAll) {
        userSet = tier;
        break;
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
    };
    const setKey = userSet || 'BUM';
    const info = setInfo[setKey];
    // Готовим результат для inline query
    const result = {
      type: 'photo',
      id: `pashu_${user.id}_${Date.now()}`, // Уникальный ID на основе user_id и времени
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
            {
              text: info.btn,
              url: tmaLink
            }
          ]
        ]
      }
    };

    console.log('📝 prepare-share-message: Подготовленный result:', JSON.stringify(result, null, 2));

    // Подготавливаем тело запроса
    const requestBody = {
      user_id: parseInt(user.telegram_id),
      result: result,
      allow_user_chats: true,
      allow_bot_chats: true,
      allow_group_chats: true,
      allow_channel_chats: true
    };

    console.log('📝 prepare-share-message: Тело запроса:', JSON.stringify(requestBody, null, 2));

    // Вызываем savePreparedInlineMessage
    const response = await fetch(`https://api.telegram.org/bot${botToken}/savePreparedInlineMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const telegramResult = await response.json();
    console.log('📝 prepare-share-message: Ответ от Telegram API:', JSON.stringify(telegramResult, null, 2));

    if (!telegramResult.ok) {
      console.error('❌ prepare-share-message: Ошибка Telegram API:', telegramResult);
      throw new Error(`Telegram API error: ${telegramResult.description}`);
    }
    return new Response(JSON.stringify({
      prepared_message_id: telegramResult.result.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('prepare-share-message error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
