import { extractItems } from '@/lib/ai/extraction'

export async function POST(req: Request) {
  try {
    const { text, imageBase64 } = await req.json()
    const object = await extractItems(text, imageBase64)
    return Response.json(object)
  } catch (error) {
    console.error('Extraction error:', error)
    return Response.json(
      { error: 'Failed to extract items from description' },
      { status: 500 }
    )
  }
}
