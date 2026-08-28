import { supabase } from '@/lib/supabase/client'

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  outputFormat?: 'image/jpeg' | 'image/webp' | 'image/png'
}

/**
 * Utilitário vanilla JS que recebe um File de imagem, redimensiona proporcionalmente via Canvas
 * e comprime retornando um Blob pronto para upload e uma dataUrl para preview imediato.
 *
 * @param file Arquivo original selecionado pelo usuário
 * @param options Opções de largura máxima, altura máxima, qualidade (0 a 1) e formato de saída
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.8, outputFormat = 'image/jpeg' } = options

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido ou corrompido.'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        // Redimensionar proporcionalmente se exceder as dimensões máximas
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do Canvas.'))
          return
        }

        // Fundo branco caso a imagem original tenha transparência e estejamos exportando para JPEG
        if (outputFormat === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
        }

        // Suavização de imagem de alta qualidade
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL(outputFormat, quality)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao gerar o Blob da imagem comprimida.'))
              return
            }
            resolve({ blob, dataUrl, width, height })
          },
          outputFormat,
          quality,
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Faz a compressão e o upload de um arquivo de imagem para o Supabase Storage ('avatars' ou 'capas').
 * Retorna a URL pública gerada para persistência no banco de dados.
 */
export async function uploadImageToStorage(
  file: File,
  bucket: 'avatars' | 'capas',
  options: CompressOptions = {},
): Promise<string> {
  const { blob } = await compressImage(file, options)
  const ext =
    options.outputFormat === 'image/webp'
      ? 'webp'
      : options.outputFormat === 'image/png'
        ? 'png'
        : 'jpg'
  const randomSuffix = Math.random().toString(36).substring(2, 9)
  const timestamp = Date.now()
  const filePath = `${bucket}_${timestamp}_${randomSuffix}.${ext}`

  const { data, error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    contentType: options.outputFormat || 'image/jpeg',
    cacheControl: '3600',
    upsert: true,
  })

  if (error) {
    throw new Error(`Erro ao enviar imagem para o storage: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path)

  return publicUrl
}
