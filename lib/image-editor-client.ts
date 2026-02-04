export type RemoveSolidBackgroundOptions = {
  enabled: boolean
  tolerance: number // 0..255 (distância euclidiana no RGB)
  feather?: number // suavização extra (0..255)
}

export type DrawImageOptions = {
  canvasWidth?: number
  canvasHeight?: number
  canvasSize?: number
  zoom: number
  rotateDeg: number
  offsetX: number
  offsetY: number
  removeBackground?: RemoveSolidBackgroundOptions
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

  const rb = options.removeBackground
  if (rb?.enabled) {
    removeSolidBackground(ctx, width, height, rb.tolerance, rb.feather ?? 20)
  }

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

function removeSolidBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tolerance: number,
  feather: number
) {
  const tol = clamp(tolerance, 0, 255)
  const fea = clamp(feather, 0, 255)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const bg = estimateBackgroundColor(data, width, height)
  const bgR = bg[0]
  const bgG = bg[1]
  const bgB = bg[2]

  // distância máxima possível no RGB
  // sqrt(255^2*3) ≈ 441
  const maxDist = 441
  const tolDist = (tol / 255) * maxDist
  const featherDist = (fea / 255) * maxDist

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)

    if (dist <= tolDist) {
      data[i + 3] = 0
      continue
    }

    if (featherDist > 0 && dist <= tolDist + featherDist) {
      const t = (dist - tolDist) / featherDist // 0..1
      data[i + 3] = Math.round(data[i + 3] * clamp01(t))
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

function estimateBackgroundColor(data: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  // Média de pequenos blocos nos 4 cantos
  const sampleSize = Math.max(3, Math.floor(Math.min(width, height) * 0.03))

  const corners: Array<[number, number]> = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ]

  let rSum = 0
  let gSum = 0
  let bSum = 0
  let count = 0

  for (const [sx, sy] of corners) {
    for (let y = sy; y < sy + sampleSize; y++) {
      for (let x = sx; x < sx + sampleSize; x++) {
        const idx = (y * width + x) * 4
        const a = data[idx + 3]
        // Só considera pixels visíveis
        if (a < 10) continue
        rSum += data[idx]
        gSum += data[idx + 1]
        bSum += data[idx + 2]
        count++
      }
    }
  }

  if (count === 0) return [0, 0, 0]
  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)]
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function clamp01(v: number) {
  return clamp(v, 0, 1)
}
