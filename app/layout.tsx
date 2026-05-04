import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ByOrbit Agent Studio',
  description: '농산 부산물 분석 통합 스튜디오',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  )
}
