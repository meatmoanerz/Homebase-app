import type { NextRequest } from 'next/server'
import type { ReceiptFile } from '@/lib/receipts/parse-receipt'

// Vercel caps request bodies at 4.5 MB; the app shrinks photos well below this.
const MAX_BYTES = 4_400_000

const TYPES: Record<string, ReceiptFile['mediaType']> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'application/pdf': 'application/pdf',
}

function sniff(bytes: Uint8Array): ReceiptFile['mediaType'] | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
  return null
}

/**
 * The receipt file from a request: multipart field "file" (from the app or a
 * Shortcut "Form" body) or the raw body (Shortcut "File" body).
 */
export async function readReceiptUpload(request: NextRequest): Promise<ReceiptFile | { error: string }> {
  const contentType = request.headers.get('content-type') ?? ''
  let bytes: Uint8Array
  let declared = ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) return { error: 'Fältet "file" saknas' }
    declared = file.type
    bytes = new Uint8Array(await file.arrayBuffer())
  } else {
    declared = contentType.split(';')[0].trim()
    bytes = new Uint8Array(await request.arrayBuffer())
  }
  if (bytes.length === 0) return { error: 'Tom fil' }
  if (bytes.length > MAX_BYTES) return { error: 'Filen är för stor (max ~4 MB). Minska bilden i genvägen.' }
  const mediaType = sniff(bytes) ?? TYPES[declared.toLowerCase()]
  if (!mediaType) return { error: 'Okänt filformat — skicka JPEG, PNG eller PDF (HEIC: konvertera till JPEG i genvägen).' }
  return { data: Buffer.from(bytes).toString('base64'), mediaType }
}
