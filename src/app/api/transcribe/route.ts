import { experimental_transcribe as transcribe } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null

  if (!audio) {
    return Response.json({ error: 'audio file is required' }, { status: 400 })
  }

  const arrayBuffer = await audio.arrayBuffer()

  const result = await transcribe({
    model: openai.transcription('gpt-4o-mini-transcribe'),
    audio: new Uint8Array(arrayBuffer),
    providerOptions: {
      openai: { language: 'en' },
    },
  })

  return Response.json({ text: result.text })
}
