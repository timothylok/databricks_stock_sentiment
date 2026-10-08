import type { Metadata } from "next"
import "./globals.css"
import { ThemeToggle } from "@/components/ThemeToggle"

export const metadata: Metadata = {
  title: "Stock Sentiment",
  description: "Daily stock sentiment dashboard powered by Cloudflare D1",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script sets the theme class before paint, so the server markup can't match it
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          {children}
        </main>
      </body>
    </html>
  )
}

// Saved choice wins; otherwise follow the OS setting
const themeScript = `try {
  const t = localStorage.getItem("theme")
  if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches))
    document.documentElement.classList.add("dark")
} catch {}`
