'use client'

import { useState, useCallback } from 'react'
import InputPanel, { type CommandType, type CommandArgs } from '@/components/studio/InputPanel'
import TerminalPanel, { type TerminalLine } from '@/components/studio/TerminalPanel'
import ResultPanel, { type ResultData } from '@/components/studio/ResultPanel'
import type { ByproductSampleDetail } from '@/components/studio/ByproductSampleView'
import { predictDrying, type DryingMethod } from '@/lib/analysis/drying-retention'

export default function StudioPage() {
  const [lines,          setLines]         = useState<TerminalLine[]>([])
  const [isRunning,      setIsRunning]     = useState(false)
  const [result,         setResult]        = useState<ResultData>(null)
  const [terminalOpen,   setTerminalOpen]  = useState(true)

  const addLine = useCallback((line: TerminalLine) => {
    setLines(prev => [...prev, line])
  }, [])

  const clearTerminal = useCallback(() => {
    setLines([])
    setResult(null)
  }, [])

  const loadSample = useCallback(async (id: string) => {
    setResult(null)
    setLines([{ type: 'info', text: `부산물 샘플 로드 중: ${id}` }])
    try {
      const res  = await fetch(`/api/byproduct-samples/${id}`)
      const data = await res.json() as ByproductSampleDetail
      setResult({ kind: 'byproduct_sample', data })
      setLines([{ type: 'success', text: `✅ ${data.sample_name} 로드 완료` }])
    } catch (err) {
      setLines([{ type: 'error', text: `샘플 로드 실패: ${String(err)}` }])
    }
  }, [])

  const predictDryingCallback = useCallback(async (
    sampleId: string,
    method:   DryingMethod,
    targetMoisturePct: number,
  ) => {
    setIsRunning(true)
    setResult(null)
    setLines([{ type: 'info', text: `건조 예측 계산 중: ${method}` }])
    try {
      const res    = await fetch(`/api/byproduct-samples/${sampleId}`)
      const sample = await res.json() as ByproductSampleDetail

      const freshMoisture = sample.moisture_after_pct ?? 77.57
      const prediction    = predictDrying(
        sample.nutrients,
        sample.nutrient_units,
        freshMoisture,
        targetMoisturePct,
        method,
      )

      setResult({ kind: 'dry_predict', data: { sample, prediction } })
      setLines([{
        type: 'success',
        text: `✅ ${sample.sample_name} → ${method} (목표 수분 ${targetMoisturePct}%) 예측 완료 · 농축 계수 ×${prediction.concentrationFactor.toFixed(2)}`,
      }])
    } catch (err) {
      setLines([{ type: 'error', text: `예측 실패: ${String(err)}` }])
    } finally {
      setIsRunning(false)
    }
  }, [])

  const execute = useCallback(async (command: CommandType, args: CommandArgs) => {
    if (isRunning) return
    setIsRunning(true)
    setResult(null)
    setLines([])

    try {
      const res = await fetch('/api/cli', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ command, args }),
      })

      if (!res.body) throw new Error('스트림 없음')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)
          try {
            const event = JSON.parse(json) as Record<string, unknown>
            const type  = event.type as string

            if (type === 'done') continue

            if (type === 'result_data') {
              setResult({ kind: command, data: event.data } as ResultData)
              continue
            }

            addLine({
              type: type as TerminalLine['type'],
              text: (event.text as string) ?? '',
            })
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      addLine({ type: 'error', text: `연결 오류: ${String(err)}` })
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, addLine])

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-green-500 font-bold text-sm tracking-wider">ByOrbit</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-400 text-xs">Agent Studio</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
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
              onClear={clearTerminal}
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
