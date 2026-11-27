'use client'

import { useState, useCallback, useRef } from 'react'
import type { CommandType, CommandArgs } from '@/components/studio/InputPanel'
import type { TerminalLine } from '@/components/studio/TerminalPanel'
import type { ResultData } from '@/components/studio/ResultPanel'
import type { ByproductSampleDetail } from '@/components/studio/ByproductSampleView'
import { predictDrying, type DryingMethod } from '@/lib/analysis/drying-retention'
import { parseCommandLine, helpLines } from '@/lib/cli/parse'

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function useStudioRunner() {
  const [lines,     setLines]     = useState<TerminalLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [result,    setResult]    = useState<ResultData>(null)
  const historyRef = useRef<string[]>([])

  const addLine = useCallback((line: TerminalLine) => {
    setLines(prev => [...prev, line])
  }, [])

  const addLines = useCallback((ls: TerminalLine[]) => {
    setLines(prev => [...prev, ...ls])
  }, [])

  const clear = useCallback(() => {
    setLines([])
    setResult(null)
  }, [])

  // reset=true: 폼 버튼 실행(기존 동작, 출력 초기화) / false: 타이핑 세션(누적)
  const loadSample = useCallback(async (id: string, reset = true) => {
    setResult(null)
    const first: TerminalLine = { type: 'info', text: `부산물 샘플 로드 중: ${id}` }
    if (reset) setLines([first]); else addLine(first)
    const out = (l: TerminalLine) => (reset ? setLines([l]) : addLine(l))
    try {
      const res  = await fetch(`/api/byproduct-samples/${id}`)
      const data = await res.json() as ByproductSampleDetail & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult({ kind: 'byproduct_sample', data })
      out({ type: 'success', text: `✅ ${data.sample_name} 로드 완료` })
    } catch (err) {
      out({ type: 'error', text: `샘플 로드 실패: ${errMsg(err)}` })
    }
  }, [addLine])

  const predictDryingCallback = useCallback(async (
    sampleId: string,
    method:   DryingMethod,
    targetMoisturePct: number,
    reset = true,
  ) => {
    setIsRunning(true)
    setResult(null)
    const first: TerminalLine = { type: 'info', text: `건조 예측 계산 중: ${method}` }
    if (reset) setLines([first]); else addLine(first)
    const out = (l: TerminalLine) => (reset ? setLines([l]) : addLine(l))
    try {
      const res    = await fetch(`/api/byproduct-samples/${sampleId}`)
      const sample = await res.json() as ByproductSampleDetail & { error?: string }
      if (!res.ok || sample.error) throw new Error(sample.error ?? `HTTP ${res.status}`)

      const freshMoisture = sample.moisture_after_pct ?? 77.57
      const prediction    = predictDrying(
        sample.nutrients,
        sample.nutrient_units,
        freshMoisture,
        targetMoisturePct,
        method,
      )

      setResult({ kind: 'dry_predict', data: { sample, prediction } })
      out({
        type: 'success',
        text: `✅ ${sample.sample_name} → ${method} (목표 수분 ${targetMoisturePct}%) 예측 완료 · 농축 계수 ×${prediction.concentrationFactor.toFixed(2)}`,
      })
    } catch (err) {
      out({ type: 'error', text: `예측 실패: ${errMsg(err)}` })
    } finally {
      setIsRunning(false)
    }
  }, [addLine])

  const execute = useCallback(async (command: CommandType, args: CommandArgs, reset = true) => {
    if (isRunning) return
    setIsRunning(true)
    setResult(null)
    if (reset) setLines([])

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

  const runCommandLine = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isRunning) return
    historyRef.current.push(trimmed)
    addLine({ type: 'cmd', text: trimmed })

    const cmd = parseCommandLine(trimmed)
    switch (cmd.kind) {
      case 'error':
        addLine({ type: 'error', text: cmd.message })
        return
      case 'help':
        addLines(helpLines(cmd.topic).map(t => ({ type: 'info' as const, text: t })))
        return
      case 'clear':
        clear()
        return
      case 'history':
        addLines(historyRef.current.map((h, i) => ({
          type: 'info' as const, text: `${String(i + 1).padStart(3)}  ${h}`,
        })))
        return
      case 'api':
        await execute(cmd.command, cmd.args, false)
        return
      case 'sample':
        await loadSample(cmd.id, false)
        return
      case 'dry':
        await predictDryingCallback(cmd.id, cmd.method, cmd.target, false)
        return
      case 'thesaurus': {
        setIsRunning(true)
        try {
          const res  = await fetch(`/api/thesaurus?q=${encodeURIComponent(cmd.q)}`)
          const data = await res.json() as {
            exact?: unknown; related?: unknown; suggestions?: unknown; api_status?: unknown; error?: string
          }
          if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
          type Entry = {
            canonical_ko?: string; synonyms?: string[]; hypernym?: string | null
            hyponyms?: string[]; nics_name?: string | null; nics_code?: string | null
          }
          const list = (v: unknown) =>
            Array.isArray(v) && v.length ? v.join(', ') : '(없음)'
          const entryName = (x: Entry) =>
            `${x.canonical_ko ?? '?'}${x.nics_code ? ` [${x.nics_code}]` : ''}`
          const ex = data.exact as Entry | null | undefined
          const related = (Array.isArray(data.related) ? data.related : []) as Entry[]
          addLines([
            ...(ex
              ? [
                  { type: 'result' as const, text: `${entryName(ex)}${ex.nics_name ? ` — NICS: ${ex.nics_name}` : ''}` },
                  { type: 'info'   as const, text: `  동의어:   ${list(ex.synonyms)}` },
                  { type: 'info'   as const, text: `  상위어:   ${ex.hypernym ?? '(없음)'}` },
                  { type: 'info'   as const, text: `  하위어:   ${list(ex.hyponyms)}` },
                ]
              : [{ type: 'warning' as const, text: `"${cmd.q}" 일치 항목 없음` }]),
            { type: 'info',    text: `  관련 항목: ${related.length ? related.map(entryName).join(', ') : '(없음)'}` },
            { type: 'info',    text: `  추천 검색: ${list(data.suggestions)}` },
            { type: 'success', text: `api_status: ${String(data.api_status ?? '-')}` },
          ])
        } catch (err) {
          addLine({ type: 'error', text: `시소러스 조회 실패: ${errMsg(err)}` })
        } finally {
          setIsRunning(false)
        }
        return
      }
      case 'samples': {
        setIsRunning(true)
        try {
          const res  = await fetch('/api/byproduct-samples')
          const data = await res.json() as unknown
          const err  = (data as { error?: string } | null)?.error
          if (!res.ok || err) throw new Error(err ?? `HTTP ${res.status}`)
          const rows = (Array.isArray(data)
            ? data
            : ((data as { samples?: unknown[] }).samples ?? [])) as { id?: string; sample_name?: string }[]
          if (!rows.length) addLine({ type: 'info', text: '샘플이 없습니다.' })
          else addLines(rows.map(r => ({
            type: 'info' as const, text: `${r.id ?? '?'}  ${r.sample_name ?? ''}`,
          })))
        } catch (err) {
          addLine({ type: 'error', text: `샘플 목록 조회 실패 (DB 연결 확인): ${errMsg(err)}` })
        } finally {
          setIsRunning(false)
        }
        return
      }
    }
  }, [isRunning, addLine, addLines, clear, execute, loadSample, predictDryingCallback])

  return {
    lines, isRunning, result,
    addLine, clear, execute, loadSample,
    predictDrying: predictDryingCallback,
    runCommandLine,
  }
}
