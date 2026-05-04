import { checkOllamaHealth, ollamaGenerate, ollamaStream } from './ollama'
import { claudeGenerate, claudeStream } from './claude'
import { SYSTEM_PROMPT } from './prompts'

export type InferenceMode = 'auto' | 'local' | 'ollama' | 'api'

export interface RouterConfig {
  mode:                InferenceMode
  complexityThreshold: number  // 이 값 이상이면 LLM 사용
}

function getConfig(): RouterConfig {
  return {
    mode: (process.env.INFERENCE_MODE ?? 'auto') as InferenceMode,
    complexityThreshold: parseInt(process.env.INFERENCE_COMPLEXITY_THRESHOLD ?? '3', 10),
  }
}

// complexity score 산출 (0~5)
export function computeComplexity(ruleFailCount: number, flagCount: number): number {
  return Math.min(5, ruleFailCount + Math.floor(flagCount / 2))
}

// 스트리밍 없이 텍스트 생성
export async function generateNarrative(
  userPrompt: string,
  complexity: number,
): Promise<string> {
  const { mode, complexityThreshold } = getConfig()

  // local-only: LLM 없이 스킵
  if (mode === 'local') return ''

  const useLLM = mode === 'api' || mode === 'ollama' || mode === 'auto' && complexity >= complexityThreshold
  if (!useLLM) return ''

  // ollama 먼저 시도 (api 전용 모드가 아닌 경우)
  if (mode !== 'api') {
    const ollamaOk = await checkOllamaHealth()
    if (ollamaOk) {
      try {
        return await ollamaGenerate(`${SYSTEM_PROMPT}\n\n${userPrompt}`)
      } catch {
        if (mode === 'ollama') throw new Error('Ollama 연결 실패')
      }
    } else if (mode === 'ollama') {
      throw new Error('Ollama 서버 응답 없음')
    }
  }

  // Claude API 폴백
  return claudeGenerate(SYSTEM_PROMPT, userPrompt)
}

// 스트리밍 생성
export async function streamNarrative(
  userPrompt: string,
  complexity: number,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const { mode, complexityThreshold } = getConfig()

  if (mode === 'local') return

  const useLLM = mode === 'api' || mode === 'ollama' || mode === 'auto' && complexity >= complexityThreshold
  if (!useLLM) return

  // ollama 먼저 시도
  if (mode !== 'api') {
    const ollamaOk = await checkOllamaHealth()
    if (ollamaOk) {
      try {
        await ollamaStream(`${SYSTEM_PROMPT}\n\n${userPrompt}`, onChunk)
        return
      } catch {
        if (mode === 'ollama') throw new Error('Ollama 스트리밍 실패')
      }
    } else if (mode === 'ollama') {
      throw new Error('Ollama 서버 응답 없음')
    }
  }

  // Claude API 폴백
  await claudeStream(SYSTEM_PROMPT, userPrompt, onChunk)
}
