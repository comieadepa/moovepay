// Client-only image helpers (compress/resize) — usa Canvas/DOM APIs

export type CompressOptions = {
  maxWidth: number
  maxHeight: number
  maxBytes: number
  mimeType?: 'image/webp' | 'image/jpeg'
  quality?: number
  minQuality?: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.loading = 'eager'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Falha ao ler imagem'))
      img.src = url
    })

    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Falha ao gerar imagem'))
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}

export async function compressImageFile(input: File, options: CompressOptions): Promise<File> {
  const {
    maxWidth,
    maxHeight,
    maxBytes,
    mimeType = 'image/webp',
    quality = 0.82,
    minQuality = 0.55,
  } = options

  if (!input.type.startsWith('image/')) {
    throw new Error('Arquivo inválido: envie uma imagem')
  }

  // limite de entrada para evitar travar o browser
  const hardInputLimit = 15 * 1024 * 1024 // 15MB
  if (input.size > hardInputLimit) {
    throw new Error('Imagem muito grande (máx. 15MB antes da compressão)')
  }

  const img = await fileToImage(input)

  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height

  if (!srcW || !srcH) {
    throw new Error('Não foi possível ler as dimensões da imagem')
  }

  const ratio = Math.min(maxWidth / srcW, maxHeight / srcH, 1)
  const targetW = Math.max(1, Math.round(srcW * ratio))
  const targetH = Math.max(1, Math.round(srcH * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas não suportado')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, targetW, targetH)

  let q = clamp(quality, 0.4, 0.95)
  let blob = await canvasToBlob(canvas, mimeType, q)

  // se ainda estiver acima, tenta reduzir qualidade
  while (blob.size > maxBytes && q > minQuality) {
    q = clamp(q - 0.08, 0.35, 0.95)
    blob = await canvasToBlob(canvas, mimeType, q)
  }

  if (blob.size > maxBytes) {
    // ainda acima do limite: tenta reduzir mais o tamanho (escala) uma vez
    const scaleDown = 0.85
    canvas.width = Math.max(1, Math.round(targetW * scaleDown))
    canvas.height = Math.max(1, Math.round(targetH * scaleDown))
    const ctx2 = canvas.getContext('2d', { alpha: false })
    if (!ctx2) throw new Error('Canvas não suportado')
    ctx2.imageSmoothingEnabled = true
    ctx2.imageSmoothingQuality = 'high'
    ctx2.drawImage(img, 0, 0, canvas.width, canvas.height)

    q = clamp(q, minQuality, 0.95)
    blob = await canvasToBlob(canvas, mimeType, q)
  }

  if (blob.size > maxBytes) {
    throw new Error('Não foi possível comprimir dentro do limite. Tente uma imagem menor.')
  }

  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'webp'
  const nameBase = input.name.replace(/\.[^/.]+$/, '') || 'image'

  return new File([blob], `${nameBase}.${ext}`, { type: mimeType })
}
