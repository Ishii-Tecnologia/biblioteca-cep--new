export interface BookMetadata {
  isbn: string
  titulo_de_livro: string
  autor: string
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
  return raw.replace(/[^0-9X]/gi, '').trim()
}

/**
 * Busca dados do livro pelo ISBN no Google Books API e, como fallback, na Open Library.
 */
export async function fetchBookByIsbn(isbnRaw: string): Promise<BookMetadata> {
  const cleanIsbn = sanitizeIsbn(isbnRaw)
  if (!cleanIsbn || (cleanIsbn.length !== 10 && cleanIsbn.length !== 13)) {
    throw new Error('ISBN inválido. O código de barras/ISBN deve possuir 10 ou 13 dígitos.')
  }

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
    `Não foram encontradas informações para o ISBN/código "${cleanIsbn}". Você pode preencher os dados manualmente.`,
  )
}
