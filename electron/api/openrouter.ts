import type { ModelInfo, ChatRequest } from '../../src/types/index'

const BASE_URL = 'https://openrouter.ai/api/v1'

// ──────────────────────────────────────────────────────────
// Active stream controllers (abort support)
// ──────────────────────────────────────────────────────────
const activeControllers = new Map<string, AbortController>()

// ──────────────────────────────────────────────────────────
// Fetch the full model catalog
// ──────────────────────────────────────────────────────────
export async function fetchAllModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE_URL}/models`)
  if (!res.ok) {
    throw new Error(`OpenRouter models fetch failed: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { data: ModelInfo[] }
  return data.data
}

// ──────────────────────────────────────────────────────────
// Fetch a single model's metadata
// ──────────────────────────────────────────────────────────
export async function fetchModelInfo(modelId: string): Promise<ModelInfo | null> {
  const models = await fetchAllModels()
  return models.find((m) => m.id === modelId) ?? null
}

// ──────────────────────────────────────────────────────────
// Streaming chat completion
// ──────────────────────────────────────────────────────────
export interface StreamCallbacks {
  onToken:   (requestId: string, token: string)    => void
  onDone:    (requestId: string, fullText: string) => void
  onError:   (requestId: string, error: string)    => void
  onAborted: (requestId: string)                   => void
}

export async function streamChat(
  request: ChatRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const { requestId, apiKey, model, messages, options } = request
  const controller = new AbortController()
  activeControllers.set(requestId, controller)

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vellum.app',
        'X-Title': 'Vellum Desktop',
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: options?.temperature ?? 0.7,
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
        top_p: options?.topP ?? 1,
      }),
      signal: controller.signal,
    })

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '')
      callbacks.onError(requestId, `${res.status} ${res.statusText}: ${errText}`)
      return
    }

    let fullText = ''
    const decoder = new TextDecoder()
    const reader = res.body.getReader()

    // Read stream chunk by chunk
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const delta: string | undefined = json?.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            callbacks.onToken(requestId, delta)
          }
          // Check for finish reason
          const finishReason = json?.choices?.[0]?.finish_reason
          if (finishReason === 'stop' || finishReason === 'length') {
            // Normal completion — continue reading until [DONE]
          }
        } catch {
          // Partial / non-JSON lines are normal at SSE chunk boundaries
        }
      }
    }

    callbacks.onDone(requestId, fullText)
  } catch (err: unknown) {
    const error = err as Error
    if (error.name === 'AbortError') {
      callbacks.onAborted(requestId)
    } else {
      callbacks.onError(requestId, error.message ?? 'Unknown error')
    }
  } finally {
    activeControllers.delete(requestId)
  }
}

// ──────────────────────────────────────────────────────────
// Abort a streaming request
// ──────────────────────────────────────────────────────────
export function stopChat(requestId: string): void {
  const controller = activeControllers.get(requestId)
  if (controller) {
    controller.abort()
    activeControllers.delete(requestId)
  }
}
