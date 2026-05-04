import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-6'

export async function claudeGenerate(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = msg.content[0]
  if (block.type !== 'text') throw new Error('Unexpected Claude response type')
  return block.text
}

export async function claudeStream(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text)
    }
  }
}
