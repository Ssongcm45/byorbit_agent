const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? 'gemma3:12b'

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function ollamaGenerate(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:  OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json() as { response: string }
  return data.response
}

export async function ollamaStream(
  prompt: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok || !res.body) throw new Error(`Ollama stream error: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const json = JSON.parse(line) as { response?: string; done?: boolean }
        if (json.response) onChunk(json.response)
      } catch {
        // 파싱 실패 무시
      }
    }
  }
}
