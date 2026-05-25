'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

// ID счётчика. Можно переопределить через env (NEXT_PUBLIC_YANDEX_METRIKA_ID),
// по умолчанию — счётчик Постплана.
const YM_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? 109409470);

// Типизация глобальной функции ym, которую инициализирует счётчик.
declare global {
  interface Window {
    ym?: (
      id: number,
      action: string,
      ...params: unknown[]
    ) => void;
  }
}

/**
 * Отправляет хит при каждой клиентской навигации (App Router рендерит
 * переходы без полной перезагрузки, поэтому Метрика их не видит сама).
 * Первый хит делает init({...}) при загрузке — здесь шлём только последующие.
 */
function YandexMetrikaPageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.ym !== 'function') return;

    const query = searchParams.toString();
    const url = pathname + (query ? `?${query}` : '');

    window.ym(YM_ID, 'hit', url, {
      referer: document.referrer,
      title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}

export function YandexMetrika() {
  // На локальной разработке счётчик не грузим, чтобы не пачкать статистику.
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}', 'ym');
          ym(${YM_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
        `}
      </Script>

      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${YM_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>

      {/* Suspense обязателен: useSearchParams без него ломает статический рендер. */}
      <Suspense fallback={null}>
        <YandexMetrikaPageviews />
      </Suspense>
    </>
  );
}
