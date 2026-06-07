import { experimental_transcribe as transcribe } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

export async function POST(req: Request) {
  const formData = await req.formData()
  const audio = formData.get('audio') as File | null

  if (!audio) {
    return Response.json({ error: 'audio file is required' }, { status: 400 })
  }

  const result = await transcribe({
    model: openai.transcription('whisper-1'),
    audio: new Uint8Array(await audio.arrayBuffer()),
    mediaType: 'audio/webm',
    providerOptions: {
      openai: { language: 'en' },
    },
  })

  return Response.json({ text: result.text })
}
