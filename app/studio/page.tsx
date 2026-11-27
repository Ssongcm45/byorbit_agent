'use client'

import { useState } from 'react'
import Link from 'next/link'
import InputPanel from '@/components/studio/InputPanel'
import TerminalPanel from '@/components/studio/TerminalPanel'
import ResultPanel from '@/components/studio/ResultPanel'
import { useStudioRunner } from '@/components/studio/useStudioRunner'

export default function StudioPage() {
  const {
    lines, isRunning, result, clear, execute, loadSample,
    predictDrying: predictDryingCallback, runCommandLine,
  } = useStudioRunner()
  const [terminalOpen, setTerminalOpen] = useState(true)

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-green-500 font-bold text-sm tracking-wider">ByOrbit</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-400 text-xs">Agent Studio</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <Link href="/cli" className="text-gray-400 hover:text-green-400 font-mono transition-colors">&gt;_ CLI</Link>
          <span className="w-2 h-2 rounded-full bg-green-500/60" />
          <span>Local mode</span>
        </div>
      </header>

      {/* 3-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Input panel */}
        <div className="w-72 shrink-0 overflow-hidden border-r border-gray-800">
          <InputPanel onExecute={execute} onLoadSample={loadSample} onPredictDrying={predictDryingCallback} isRunning={isRunning} />
        </div>

        {/* Center: Results */}
        <div className="flex-1 overflow-hidden">
          <ResultPanel result={result} />
        </div>

        {/* Right: Terminal (collapsible) */}
        {terminalOpen ? (
          <div className="w-[600px] shrink-0 overflow-hidden border-l border-gray-800">
            <TerminalPanel
              lines={lines}
              isRunning={isRunning}
              onClear={clear}
              onCommand={runCommandLine}
              onCollapse={() => setTerminalOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setTerminalOpen(true)}
            className="shrink-0 border-l border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors w-7 flex flex-col items-center justify-center gap-3"
            title="터미널 열기"
          >
            <span className="text-gray-600 text-[10px] font-mono [writing-mode:vertical-rl] tracking-widest select-none">
              TERMINAL
            </span>
            {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          </button>
        )}
      </div>
    </div>
  )
}
