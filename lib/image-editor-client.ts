export type DrawImageOptions = {
  canvasWidth?: number
  canvasHeight?: number
  canvasSize?: number
  zoom: number
  rotateDeg: number
  offsetX: number
  offsetY: number
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const img = new Image()
    img.decoding = 'async'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
      img.src = objectUrl
    })

    return img
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function drawImageToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: DrawImageOptions
): { width: number; height: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado')

  const sizeFallback = Math.max(64, Math.floor(options.canvasSize || 512))
  const width = Math.max(64, Math.floor(options.canvasWidth || sizeFallback))
  const height = Math.max(64, Math.floor(options.canvasHeight || sizeFallback))

  canvas.width = width
  canvas.height = height

  ctx.clearRect(0, 0, width, height)

  const imgW = image.naturalWidth || image.width
  const imgH = image.naturalHeight || image.height

  // Cover + zoom
  const baseScale = Math.max(width / imgW, height / imgH)
  const scale = baseScale * Math.max(0.1, options.zoom || 1)

  const rotateRad = ((options.rotateDeg || 0) * Math.PI) / 180

  ctx.save()
  ctx.translate(width / 2 + (options.offsetX || 0), height / 2 + (options.offsetY || 0))
  ctx.rotate(rotateRad)
  ctx.scale(scale, scale)

  ctx.drawImage(image, -imgW / 2, -imgH / 2, imgW, imgH)
  ctx.restore()

  return { width, height }
}

export function drawImageToSquareCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: DrawImageOptions
) {
  const size = Math.max(64, Math.floor(options.canvasSize || 512))
  return drawImageToCanvas(canvas, image, { ...options, canvasWidth: size, canvasHeight: size })
}

export async function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  type: 'image/png' | 'image/webp' | 'image/jpeg' = 'image/png',
  quality?: number
): Promise<File> {
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar imagem'))),
      type,
      quality
    )
  })

  const ext = type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'png'
  const safeBase = (fileName || 'imagem').replace(/\.[a-z0-9]+$/i, '')
  return new File([blob], `${safeBase}.${ext}`, { type })
}

