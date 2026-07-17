import type {
  ModelInfo, ChatRequest, ChatMessage, MessagePart,
  EmbeddingRequest, EmbeddingResult, TranscriptionRequest, TTSRequest,
} from '../../src/types/index'

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
// Convert ChatMessage to OpenRouter API message format
// Handles both plain text and multimodal parts
// ──────────────────────────────────────────────────────────
function toAPIMessage(msg: ChatMessage): Record<string, unknown> {
  // If there are multimodal parts, build content array
  if (msg.parts && msg.parts.length > 0) {
    const contentParts: unknown[] = []
    for (const part of msg.parts) {
      if (part.type === 'text') {
        contentParts.push({ type: 'text', text: part.text })
      } else if (part.type === 'image_url') {
        contentParts.push({
          type: 'image_url',
          image_url: { url: part.url },
        })
      } else if (part.type === 'audio') {
        // Some models accept audio as an image_url style data URI
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${part.mimeType};base64,${part.data}` },
        })
        // Also add text indicating transcription if available
        if (part.transcript) {
          contentParts.push({
            type: 'text',
            text: `[Audio file: ${part.fileName ?? 'audio'} — Transcription: "${part.transcript}"]`,
          })
        }
      } else if (part.type === 'video_url') {
        contentParts.push({
          type: 'image_url',
          image_url: { url: part.url },
        })
      }
      // embedding and tts_audio parts are not sent to API — they are output only
    }

    // Append any plain text content
    if (msg.content) {
      contentParts.push({ type: 'text', text: msg.content })
    }

    return { role: msg.role, content: contentParts }
  }

  // Plain text
  return { role: msg.role, content: msg.content }
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
        messages: messages.map(toAPIMessage),
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

// ──────────────────────────────────────────────────────────
// Embeddings
// ──────────────────────────────────────────────────────────
export async function fetchEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vellum.app',
      'X-Title': 'Vellum Desktop',
    },
    body: JSON.stringify({
      model: req.model,
      input: req.input,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Embedding request failed: ${res.status} ${errText}`)
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }>; model: string }
  const vectors = data.data[0]?.embedding ?? []
  return { vectors, dimension: vectors.length, model: data.model ?? req.model }
}

// ──────────────────────────────────────────────────────────
// Audio Transcription (Whisper)
// ──────────────────────────────────────────────────────────
export async function transcribeAudio(req: TranscriptionRequest): Promise<{ text: string }> {
  // Convert base64 to Buffer for multipart upload
  const audioBuffer = Buffer.from(req.audioBase64, 'base64')
  const ext = req.mimeType.split('/')[1]?.split(';')[0] ?? 'mp3'

  // Build multipart/form-data manually (Node.js FormData not available in Electron main)
  const boundary = `----VellumBoundary${Date.now()}`
  const CRLF = '\r\n'

  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${req.fileName}"`,
    `Content-Type: ${req.mimeType}`,
    '',
    '',
  ].join(CRLF)

  const modelPart = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="model"`,
    '',
    req.model,
    '',
  ].join(CRLF)

  const footer = `--${boundary}--${CRLF}`

  const bodyParts = [
    Buffer.from(header, 'utf-8'),
    audioBuffer,
    Buffer.from(CRLF + modelPart + footer, 'utf-8'),
  ]
  const body = Buffer.concat(bodyParts)

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'HTTP-Referer': 'https://vellum.app',
      'X-Title': 'Vellum Desktop',
    },
    body,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Transcription failed: ${res.status} ${errText}`)
  }

  const data = await res.json() as { text: string }
  return { text: data.text ?? '' }
}

// ──────────────────────────────────────────────────────────
// Text-to-Speech
// ──────────────────────────────────────────────────────────
export async function textToSpeech(req: TTSRequest): Promise<{ audioBase64: string; mimeType: string }> {
  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vellum.app',
      'X-Title': 'Vellum Desktop',
    },
    body: JSON.stringify({
      model: req.model,
      input: req.text,
      voice: req.voice ?? 'alloy',
      response_format: 'mp3',
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`TTS failed: ${res.status} ${errText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return { audioBase64: base64, mimeType: 'audio/mpeg' }
}
