'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import TerminalPanel from '@/components/studio/TerminalPanel'
import ResultPanel from '@/components/studio/ResultPanel'
import { useStudioRunner } from '@/components/studio/useStudioRunner'

export default function CliPage() {
  const { lines, isRunning, result, clear, addLine, runCommandLine } = useStudioRunner()
  const welcomed = useRef(false)

  useEffect(() => {
    if (welcomed.current) return
    welcomed.current = true
    addLine({ type: 'success', text: 'ByOrbit CLI 에 오신 것을 환영합니다.' })
    addLine({ type: 'info', text: '`help` 를 입력하면 사용 가능한 커맨드를 볼 수 있습니다. 예: analyze --mock' })
  }, [addLine])

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-green-500 font-bold text-sm tracking-wider">ByOrbit</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-400 text-xs">CLI</span>
        </div>
        <Link href="/studio" className="text-xs text-gray-400 hover:text-green-400 transition-colors">
          ← Agent Studio
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={result ? 'flex-1 min-w-0 overflow-hidden' : 'w-full overflow-hidden'}>
          <TerminalPanel lines={lines} isRunning={isRunning} onClear={clear} onCommand={runCommandLine} />
        </div>
        {result && (
          <div className="w-[55%] shrink-0 overflow-hidden border-l border-gray-800">
            <ResultPanel result={result} />
          </div>
        )}
      </div>
    </div>
  )
}
