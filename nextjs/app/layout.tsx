import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Stock Sentiment",
  description: "Daily stock sentiment dashboard powered by Databricks",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
      </body>
    </html>
  )
}
