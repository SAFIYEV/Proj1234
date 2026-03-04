import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
}

const SIRV_HOST = 'oden-pashu.sirv.com' // если у тебя другой — поставь его тут

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: cors })
  }

  try {
    const url = new URL(req.url)
    // Поддерживаем форму: https://…/image-proxy/avatars/pasha.png?t=1
    const upstreamPath = url.pathname.replace(/^\/image-proxy/, '') || '/'
    const upstream = new URL(`https://${SIRV_HOST}${upstreamPath}${url.search}`)

    // Защита: не даём ходить никуда кроме SIRV_HOST
    if (upstream.hostname !== SIRV_HOST) {
      return new Response('Forbidden', { status: 403, headers: cors })
    }

    const upstreamResp = await fetch(upstream.toString(), {
      // Пробрасываем только важные заголовки (можно расширить при необходимости)
      headers: {
        'User-Agent': 'Supabase-Edge-Image-Proxy',
        'Accept': req.headers.get('Accept') ?? '*/*',
      },
    })

    // Пробрасываем тело и базовые заголовки
    const headers = new Headers(cors)
    const ct = upstreamResp.headers.get('content-type')
    if (ct) headers.set('content-type', ct)

    // Кэширование у клиента/CDN
    const cache = upstreamResp.headers.get('cache-control') ?? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    headers.set('cache-control', cache)

    // ETag/Last-Modified/Length по возможности
    ;['etag','last-modified','content-length'].forEach(h => {
      const v = upstreamResp.headers.get(h)
      if (v) headers.set(h, v)
    })

    return new Response(req.method === 'HEAD' ? null : upstreamResp.body, {
      status: upstreamResp.status,
      headers,
    })
  } catch (e) {
    return new Response('Upstream fetch failed', { status: 502, headers: cors })
  }
})
