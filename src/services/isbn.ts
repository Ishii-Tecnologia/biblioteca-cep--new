export interface BookMetadata {
  isbn: string
  titulo_de_livro: string
  autor: string
  autor_espiritual?: string
  autor_mediunico?: string
  editora?: string
  ano_publicacao?: number
  categoria?: string
  sinopse?: string
  capa_url?: string
}

/**
 * Normaliza e limpa código ISBN / EAN (remove traços, espaços e caracteres inválidos)
 */
export function sanitizeIsbn(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/[^0-9X]/gi, '')
    .toUpperCase()
    .trim()
}

/**
 * Valida o dígito verificador do ISBN-10
 */
export function isValidIsbn10(isbn10: string): boolean {
  const clean = sanitizeIsbn(isbn10)
  if (clean.length !== 10) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(clean[i], 10)
    if (isNaN(digit)) return false
    sum += digit * (10 - i)
  }

  const lastChar = clean[9]
  const checkDigit = lastChar === 'X' ? 10 : parseInt(lastChar, 10)
  if (isNaN(checkDigit)) return false

  sum += checkDigit
  return sum % 11 === 0
}

/**
 * Valida o dígito verificador do ISBN-13
 */
export function isValidIsbn13(isbn13: string): boolean {
  const clean = sanitizeIsbn(isbn13)
  if (clean.length !== 13 || !/^\d{13}$/.test(clean)) return false

  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return parseInt(clean[12], 10) === checkDigit
}

/**
 * Converte ISBN-10 para ISBN-13
 */
export function convertIsbn10To13(isbn10: string): string {
  const clean = sanitizeIsbn(isbn10)
  if (clean.length !== 10) return clean

  const base = '978' + clean.substring(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return base + checkDigit
}

/**
 * Normaliza e valida um ISBN (10 ou 13).
 * Retorna o ISBN-13 padronizado se válido, ou lança erro/retorna null.
 */
export function normalizeAndValidateIsbn(raw: string): {
  valid: boolean
  isbn13: string
  error?: string
} {
  const clean = sanitizeIsbn(raw)
  if (!clean) {
    return { valid: false, isbn13: '', error: 'ISBN não informado ou vazio.' }
  }

  if (clean.length === 10) {
    if (!isValidIsbn10(clean)) {
      return {
        valid: false,
        isbn13: '',
        error: `Dígito verificador do ISBN-10 "${clean}" é inválido.`,
      }
    }
    return { valid: true, isbn13: convertIsbn10To13(clean) }
  }

  if (clean.length === 13) {
    if (!isValidIsbn13(clean)) {
      return {
        valid: false,
        isbn13: '',
        error: `Dígito verificador do ISBN-13 "${clean}" é inválido.`,
      }
    }
    return { valid: true, isbn13: clean }
  }

  return {
    valid: false,
    isbn13: '',
    error: `Formato de ISBN inválido (${clean.length} dígitos). O ISBN deve possuir 10 ou 13 dígitos.`,
  }
}

/**
 * Formata exibição do autor com espírito e médium (F-04)
 * Padrão: "André Luiz, por Chico Xavier" ou autor simples se não houver médium
 */
export function formatAuthorDisplay(
  autorOrEspiritual?: string | null,
  autorMediunico?: string | null,
  autorFallback?: string | null,
): string {
  const espiritual = (autorOrEspiritual || '').trim()
  const mediunico = (autorMediunico || '').trim()

  if (espiritual && mediunico) {
    // Se o autor espiritual já contiver ", por", evita duplicar
    if (espiritual.toLowerCase().includes(', por ')) {
      return espiritual
    }
    return `${espiritual}, por ${mediunico}`
  }

  if (espiritual) return espiritual
  if (mediunico) return mediunico
  return (autorFallback || '').trim()
}

/**
 * Busca dados do livro pelo ISBN no Google Books API e, como fallback, na Open Library.
 */
export async function fetchBookByIsbn(isbnRaw: string): Promise<BookMetadata> {
  const validation = normalizeAndValidateIsbn(isbnRaw)
  if (!validation.valid) {
    throw new Error(validation.error || 'ISBN inválido.')
  }
  const cleanIsbn = validation.isbn13

  // 1. Tenta Google Books API
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`)
    if (res.ok) {
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        const volume = data.items[0].volumeInfo || {}
        const authors = volume.authors && volume.authors.length > 0 ? volume.authors.join(', ') : ''
        const publishedYear = volume.publishedDate
          ? parseInt(volume.publishedDate.substring(0, 4), 10)
          : undefined

        let cover = volume.imageLinks?.thumbnail || volume.imageLinks?.smallThumbnail
        if (cover && cover.startsWith('http:')) {
          cover = cover.replace('http:', 'https:')
        }

        const categories =
          volume.categories && volume.categories.length > 0 ? volume.categories[0] : ''

        return {
          isbn: cleanIsbn,
          titulo_de_livro: volume.title || '',
          autor: authors || '',
          editora: volume.publisher || '',
          ano_publicacao: publishedYear && !isNaN(publishedYear) ? publishedYear : undefined,
          categoria: categories || '',
          sinopse: volume.description || '',
          capa_url: cover || '',
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar Google Books:', err)
  }

  // 2. Fallback: Open Library API
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${cleanIsbn}.json`)
    if (res.ok) {
      const data = await res.json()
      let authorName = ''
      if (data.authors && data.authors.length > 0) {
        try {
          const authorKey = data.authors[0].key
          if (authorKey) {
            const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`)
            if (authorRes.ok) {
              const authorData = await authorRes.json()
              authorName = authorData.name || ''
            }
          }
        } catch {
          /* intentionally ignored */
        }
      }

      let year: number | undefined
      if (data.publish_date) {
        const match = data.publish_date.match(/\b\d{4}\b/)
        if (match) {
          year = parseInt(match[0], 10)
        }
      }

      let publisher = ''
      if (data.publishers && data.publishers.length > 0) {
        publisher =
          typeof data.publishers[0] === 'string'
            ? data.publishers[0]
            : data.publishers[0].name || ''
      }

      let coverUrl = ''
      if (data.covers && data.covers.length > 0) {
        coverUrl = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
      }

      let description = ''
      if (typeof data.description === 'string') {
        description = data.description
      } else if (data.description && typeof data.description.value === 'string') {
        description = data.description.value
      }

      return {
        isbn: cleanIsbn,
        titulo_de_livro: data.title || '',
        autor: authorName || '',
        editora: publisher || '',
        ano_publicacao: year,
        categoria: '',
        sinopse: description,
        capa_url: coverUrl,
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar Open Library:', err)
  }

  throw new Error(
    `Não foram encontradas informações automáticas para o ISBN "${cleanIsbn}". Você pode preencher os dados manualmente.`,
  )
}
