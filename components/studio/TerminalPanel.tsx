'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { COMMAND_NAMES } from '@/lib/cli/parse'

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
  onCommand?:  (text: string) => void
}

export default function TerminalPanel({ lines, isRunning, onClear, onCollapse, onCommand }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [value, setValue]     = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const [hints, setHints]     = useState<string[]>([])

  const focusInput = useCallback(() => {
    if (!window.getSelection()?.toString()) inputRef.current?.focus()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, hints])

  // 실행이 끝나면 입력창에 포커스 복귀
  useEffect(() => {
    if (onCommand && !isRunning) inputRef.current?.focus()
  }, [onCommand, isRunning])

  // 한글 IME 조합 중 Enter → 조합이 끝난 뒤 제출
  const submitAfterCompose = useRef(false)

  const submit = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    setHistory(h => [...h, text])
    setHistIdx(null)
    setHints([])
    setValue('')
    onCommand?.(text)
  }

  const handleCompositionEnd = () => {
    if (!submitAfterCompose.current) return
    submitAfterCompose.current = false
    // onChange 로 최종 조합 문자가 반영된 뒤 제출
    setTimeout(() => submit(inputRef.current?.value ?? ''), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      // 조합 중 Tab 은 포커스가 다른 요소(링크)로 넘어가지 않게 막는다
      if (e.key === 'Enter' || e.key === 'Tab') e.preventDefault()
      if (e.key === 'Enter') submitAfterCompose.current = true
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submit(value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!history.length) return
      const next = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1)
      setHistIdx(next)
      setValue(history[next])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx === null) return
      if (histIdx >= history.length - 1) { setHistIdx(null); setValue('') }
      else { setHistIdx(histIdx + 1); setValue(history[histIdx + 1]) }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (/\s/.test(value)) return
      const matches = COMMAND_NAMES.filter(c => c.startsWith(value.toLowerCase()))
      if (matches.length === 1) { setValue(matches[0] + ' '); setHints([]) }
      else if (matches.length > 1) setHints([...matches])
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      onClear()
    }
  }

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
      <div onClick={onCommand ? focusInput : undefined} className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
        {lines.length === 0 ? (
          <div className="text-gray-600 select-none">
            <p>┌─────────────────────────────────────────┐</p>
            <p>│  ByOrbit Agent Studio                   │</p>
            <p>│  입력 패널에서 커맨드를 실행하거나      │</p>
            <p>│  `help` 를 입력해 보세요                │</p>
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
        {hints.length > 0 && (
          <div className="text-gray-500">{hints.join('  ')}</div>
        )}
        {onCommand && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-green-400 font-bold select-none">$</span>
            <input
              ref={inputRef}
              value={value}
              onChange={e => { setValue(e.target.value); setHistIdx(null); setHints([]) }}
              onKeyDown={handleKeyDown}
              onCompositionEnd={handleCompositionEnd}
              disabled={isRunning}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              placeholder={isRunning ? '' : 'help'}
              aria-label="커맨드 입력"
              className="flex-1 bg-transparent outline-none border-none text-gray-100 font-mono text-sm placeholder:text-gray-700 caret-green-400 disabled:opacity-50"
            />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
