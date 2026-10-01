import { TICKER_META } from "@/lib/tickerMeta"

const SIZES = {
  sm: { box: "h-9 w-9 rounded-lg",  img: "h-5 w-5", text: "text-[10px]" },
  lg: { box: "h-14 w-14 rounded-xl", img: "h-8 w-8", text: "text-sm" },
}

export function TickerLogo({ ticker, size = "sm" }: { ticker: string; size?: keyof typeof SIZES }) {
  const meta = TICKER_META[ticker]
  const s = SIZES[size]

  return (
    <div
      className={`${s.box} shrink-0 flex items-center justify-center
                  ring-1 ring-black/5 dark:ring-white/15`}
      style={{ backgroundColor: meta?.color ?? "#52525b" }}
    >
      {meta?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG
        <img src={`/logos/${ticker}.svg`} alt="" className={s.img} />
      ) : (
        <span className={`${s.text} font-bold tracking-tight text-white`}>
          {meta?.mark ?? ticker.slice(0, 3)}
        </span>
      )}
    </div>
  )
}
