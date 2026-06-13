export type IconEditorState = {
  zoom: number
  rotation: number
  offsetX: number
  offsetY: number
}

export type IconImageAsset = {
  url: string
  width: number
  height: number
  fileName: string
}

const OUTPUT_SIZE = 512
export const ICON_SAFE_SCALE = 0.86

export function createDefaultIconEditorState(): IconEditorState {
  return {
    zoom: 100,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export async function loadIconImageAsset(file: File): Promise<IconImageAsset> {
  const url = URL.createObjectURL(file)
  const image = await loadImage(url)

  return {
    url,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    fileName: file.name,
  }
}

export async function renderIconFile(params: {
  asset: IconImageAsset
  editor: IconEditorState
  frameSize: number
}): Promise<File> {
  const { asset, editor, frameSize } = params
  const image = await loadImage(asset.url)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo preparar el editor de imagen.')
  }

  const fitScale = Math.min(OUTPUT_SIZE / asset.width, OUTPUT_SIZE / asset.height)
  const zoomScale = editor.zoom / 100
  const outputRatio = OUTPUT_SIZE / frameSize

  context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  context.save()
  context.translate(
    OUTPUT_SIZE / 2 + editor.offsetX * outputRatio,
    OUTPUT_SIZE / 2 + editor.offsetY * outputRatio,
  )
  context.rotate((editor.rotation * Math.PI) / 180)
  context.scale(fitScale * zoomScale * ICON_SAFE_SCALE, fitScale * zoomScale * ICON_SAFE_SCALE)
  context.drawImage(image, -asset.width / 2, -asset.height / 2, asset.width, asset.height)
  context.restore()

  const blob = await canvasToBlob(canvas)
  return new File([blob], buildOutputName(asset.fileName), { type: 'image/png' })
}

function buildOutputName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').trim() || 'icon'
  return `${base}-icon.png`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada.'))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('No se pudo exportar el icono.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
