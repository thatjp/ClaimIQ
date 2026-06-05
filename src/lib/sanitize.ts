export function sanitizeInput(input: string): string {
  return input
    .replace(/ignore previous instructions/gi, '[redacted]')
    .replace(/system prompt/gi, '[redacted]')
    .replace(/ignore all previous/gi, '[redacted]')
    .replace(/disregard (your|the) (previous|above|prior)/gi, '[redacted]')
    .replace(/you are now/gi, '[redacted]')
    .replace(/new instructions:/gi, '[redacted]')
    .substring(0, 10000)
}
