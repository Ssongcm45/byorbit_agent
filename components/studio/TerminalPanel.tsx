'use client'

import { useEffect, useRef } from 'react'

export type TerminalLine = {
  type: 'cmd' | 'info' | 'success' | 'warning' | 'error' | 'result' | 'narrative'
  text: string
}

const STYLES: Record<TerminalLine['type'], string> = {
  cmd:       'text-blue-400 font-bold',
  info:      'text-gray-300',
  success:   'text-green-400',
  warning:   'text-yellow-400',
  error:     'text-red-400',
  result:    'text-cyan-300 font-semibold',
  narrative: 'text-gray-300',
}

const PREFIX: Record<TerminalLine['type'], string> = {
  cmd:       '$ ',
  info:      '  ',
  success:   '✓ ',
  warning:   '⚠ ',
  error:     '✗ ',
  result:    '▶ ',
  narrative: '  ',
}

interface Props {
  lines:       TerminalLine[]
  isRunning:   boolean
  onClear:     () => void
  onCollapse?: () => void
}

export default function TerminalPanel({ lines, isRunning, onClear, onCollapse }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const copyAll = () => {
    const text = lines.map(l => PREFIX[l.type] + l.text).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="h-full flex flex-col bg-gray-950 border-x border-gray-800">
      {/* macOS-style header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-gray-400 text-xs font-mono ml-2 flex-1">byorbit — agent studio</span>
        <div className="flex gap-2 items-center">
          {isRunning && (
            <span className="text-xs text-green-400 animate-pulse">● 실행 중</span>
          )}
          <button
            onClick={copyAll}
            disabled={lines.length === 0}
            className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            복사
          </button>
          <button
            onClick={onClear}
            disabled={lines.length === 0}
            className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            지우기
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors pl-1 border-l border-gray-800"
              title="터미널 접기"
            >
              ›
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
        {lines.length === 0 ? (
          <div className="text-gray-600 select-none">
            <p>┌─────────────────────────────────────────┐</p>
            <p>│  ByOrbit Agent Studio                   │</p>
            <p>│  입력 패널에서 커맨드를 실행하세요      │</p>
            <p>└─────────────────────────────────────────┘</p>
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={`${STYLES[line.type]} whitespace-pre-wrap break-all`}>
              <span className="opacity-50 select-none">{PREFIX[line.type]}</span>
              {line.text}
            </div>
          ))
        )}
        {isRunning && (
          <span className="text-green-400 animate-pulse">▊</span>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
