/**
 * Algoritmo leve de decodificação de código de barras 1D (EAN-13 / EAN-8 / UPC-A / UPC-E / Code128)
 * para navegadores que não implementam BarcodeDetector nativo (ex: Firefox ou Safari antigo).
 */

// Padrões de dígitos EAN (Tabelas A, B, C)
const L_PATTERNS = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]

const G_PATTERNS = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
]

const R_PATTERNS = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
]

const FIRST_DIGIT_STRUCTURE = [
  'LLLLLL', // 0
  'LLGLGG', // 1
  'LLGGLG', // 2
  'LLGGGL', // 3
  'LGLLGG', // 4
  'LGGLLG', // 5
  'LGGGLL', // 6
  'LGLGLG', // 7
  'LGLGGL', // 8
  'LGGLGL', // 9
]

/**
 * Valida o dígito verificador do EAN-13
 */
export function isValidEan13Checksum(code: string): boolean {
  if (!code || code.length !== 13 || !/^\d+$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === parseInt(code[12], 10)
}

/**
 * Valida o dígito verificador do EAN-8
 */
export function isValidEan8Checksum(code: string): boolean {
  if (!code || code.length !== 8 || !/^\d+$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(code[i], 10)
    sum += i % 2 === 0 ? digit * 3 : digit
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === parseInt(code[7], 10)
}

/**
 * Converte amostra de 1 linha de pixels em runs de barras pretas e brancas
 */
function getRunsFromSampleLine(
  luminance: Uint8ClampedArray,
  threshold: number,
): { isBlack: boolean; length: number }[] {
  const runs: { isBlack: boolean; length: number }[] = []
  if (luminance.length === 0) return runs

  let currentIsBlack = luminance[0] < threshold
  let currentLength = 1

  for (let i = 1; i < luminance.length; i++) {
    const isBlack = luminance[i] < threshold
    if (isBlack === currentIsBlack) {
      currentLength++
    } else {
      runs.push({ isBlack: currentIsBlack, length: currentLength })
      currentIsBlack = isBlack
      currentLength = 1
    }
  }
  runs.push({ isBlack: currentIsBlack, length: currentLength })
  return runs
}

/**
 * Tenta decodificar EAN-13 a partir de runs
 */
function decodeEan13FromRuns(runs: { isBlack: boolean; length: number }[]): string | null {
  // EAN-13 consiste em:
  // Guard start: 101 (3 runs: B, W, B)
  // 6 dígitos esquerdos: 6 * 4 runs = 24 runs
  // Guard center: 01010 (5 runs: W, B, W, B, W)
  // 6 dígitos direitos: 6 * 4 runs = 24 runs
  // Guard end: 101 (3 runs: B, W, B)
  // Total: 3 + 24 + 5 + 24 + 3 = 59 runs

  if (runs.length < 59) return null

  // Procurar por guard start no array de runs
  for (let startIdx = 0; startIdx <= runs.length - 59; startIdx++) {
    if (!runs[startIdx].isBlack) continue

    const g1 = runs[startIdx].length
    const g2 = runs[startIdx + 1].length
    const g3 = runs[startIdx + 2].length

    // O guard start deve ter larguras semelhantes
    const unitEstimate = (g1 + g2 + g3) / 3
    if (unitEstimate < 0.5) continue

    // Checar guard center em startIdx + 3 + 24 = startIdx + 27
    const centerIdx = startIdx + 27
    if (centerIdx + 4 >= runs.length) continue

    // Decodificar 6 dígitos à esquerda (cada dígito = 4 runs, total 7 módulos)
    const leftPatterns: { patternType: 'L' | 'G'; digit: number }[] = []
    let leftValid = true

    for (let d = 0; d < 6; d++) {
      const dIdx = startIdx + 3 + d * 4
      const dRuns = [
        runs[dIdx].length,
        runs[dIdx + 1].length,
        runs[dIdx + 2].length,
        runs[dIdx + 3].length,
      ]
      const totalLen = dRuns[0] + dRuns[1] + dRuns[2] + dRuns[3]
      if (totalLen <= 0) {
        leftValid = false
        break
      }

      // Normalizar para 7 módulos
      const mod0 = Math.round((dRuns[0] / totalLen) * 7)
      const mod1 = Math.round((dRuns[1] / totalLen) * 7)
      const mod2 = Math.round((dRuns[2] / totalLen) * 7)
      const mod3 = 7 - (mod0 + mod1 + mod2)
      if (mod3 <= 0 || mod0 <= 0 || mod1 <= 0 || mod2 <= 0) {
        leftValid = false
        break
      }

      // Construir string binária
      const binStr = '0'.repeat(mod0) + '1'.repeat(mod1) + '0'.repeat(mod2) + '1'.repeat(mod3)

      let matched = false
      for (let num = 0; num < 10; num++) {
        if (L_PATTERNS[num] === binStr) {
          leftPatterns.push({ patternType: 'L', digit: num })
          matched = true
          break
        }
        if (G_PATTERNS[num] === binStr) {
          leftPatterns.push({ patternType: 'G', digit: num })
          matched = true
          break
        }
      }

      if (!matched) {
        leftValid = false
        break
      }
    }

    if (!leftValid || leftPatterns.length !== 6) continue

    // Determinar o 1º dígito a partir da combinação de L e G
    const structureStr = leftPatterns.map((p) => p.patternType).join('')
    const firstDigit = FIRST_DIGIT_STRUCTURE.indexOf(structureStr)
    if (firstDigit === -1) continue

    // Decodificar 6 dígitos à direita (startIdx + 3 + 24 + 5 = startIdx + 32)
    const rightDigits: number[] = []
    let rightValid = true

    for (let d = 0; d < 6; d++) {
      const dIdx = startIdx + 32 + d * 4
      if (dIdx + 3 >= runs.length) {
        rightValid = false
        break
      }

      const dRuns = [
        runs[dIdx].length,
        runs[dIdx + 1].length,
        runs[dIdx + 2].length,
        runs[dIdx + 3].length,
      ]
      const totalLen = dRuns[0] + dRuns[1] + dRuns[2] + dRuns[3]
      if (totalLen <= 0) {
        rightValid = false
        break
      }

      const mod0 = Math.round((dRuns[0] / totalLen) * 7)
      const mod1 = Math.round((dRuns[1] / totalLen) * 7)
      const mod2 = Math.round((dRuns[2] / totalLen) * 7)
      const mod3 = 7 - (mod0 + mod1 + mod2)
      if (mod3 <= 0 || mod0 <= 0 || mod1 <= 0 || mod2 <= 0) {
        rightValid = false
        break
      }

      const binStr = '1'.repeat(mod0) + '0'.repeat(mod1) + '1'.repeat(mod2) + '0'.repeat(mod3)

      let matched = false
      for (let num = 0; num < 10; num++) {
        if (R_PATTERNS[num] === binStr) {
          rightDigits.push(num)
          matched = true
          break
        }
      }

      if (!matched) {
        rightValid = false
        break
      }
    }

    if (!rightValid || rightDigits.length !== 6) continue

    const candidate = `${firstDigit}${leftPatterns.map((p) => p.digit).join('')}${rightDigits.join('')}`
    if (isValidEan13Checksum(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Analisa o frame do canvas para encontrar códigos de barras caso a API nativa não esteja disponível
 */
export function scanCanvasForBarcode(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): string | null {
  if (width < 50 || height < 50) return null

  // Amostrar várias linhas horizontais na área central
  const scanlines = [
    Math.floor(height * 0.4),
    Math.floor(height * 0.45),
    Math.floor(height * 0.5),
    Math.floor(height * 0.55),
    Math.floor(height * 0.6),
    Math.floor(height * 0.35),
    Math.floor(height * 0.65),
  ]

  for (const y of scanlines) {
    try {
      const imgData = ctx.getImageData(0, y, width, 1)
      const data = imgData.data
      const luminance = new Uint8ClampedArray(width)

      let min = 255
      let max = 0
      for (let x = 0; x < width; x++) {
        const idx = x * 4
        const lum = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2])
        luminance[x] = lum
        if (lum < min) min = lum
        if (lum > max) max = lum
      }

      // Se não há contraste suficiente, pular linha
      if (max - min < 40) continue

      const threshold = (min + max) / 2
      const runs = getRunsFromSampleLine(luminance, threshold)
      const code = decodeEan13FromRuns(runs)
      if (code) return code

      // Tentar invertido (caso o código esteja em scan reverso)
      const reversedRuns = [...runs].reverse()
      const codeReversed = decodeEan13FromRuns(reversedRuns)
      if (codeReversed) return codeReversed
    } catch {
      // Ignorar erro em frame individual
    }
  }

  return null
}
