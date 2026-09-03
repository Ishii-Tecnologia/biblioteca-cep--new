/**
 * Utilitários para padronização de arquivos CSV no sistema Biblioteca CEP.
 * Padrão adotado no projeto:
 * - Separador de campos: ponto e vírgula (;)
 * - Encoding: UTF-8 com BOM (\uFEFF) para compatibilidade nativa com Microsoft Excel e LibreOffice Calc pt-BR
 * - Tratamento de strings com delimitador, quebras de linha ou aspas duplas (RFC 4180 / compatível com Excel)
 */

export const CSV_DELIMITER = ';'

/**
 * Escapa e formata um valor individual para inclusão em CSV usando ponto e vírgula como separador.
 * Regras:
 * - Se o valor contiver o separador (;), quebras de linha (\n ou \r) ou aspas ("),
 *   o valor deve ser envolvido em aspas duplas e quaisquer aspas internas devem ser duplicadas ("").
 * - Se for nulo ou indefinido, retorna string vazia.
 */
export function formatCsvField(val: unknown, delimiter = CSV_DELIMITER): string {
  if (val === null || val === undefined) {
    return ''
  }

  const str = String(val)

  const mustQuote =
    str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')

  if (mustQuote) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Gera o conteúdo em texto CSV para uma lista de objetos ou matriz de dados.
 */
export function generateCsvContent<T extends Record<string, unknown>>(
  data: T[],
  customHeaders?: { key: keyof T; label: string }[],
  delimiter = CSV_DELIMITER,
): string {
  if (!data || data.length === 0) {
    return ''
  }

  let headerKeys: string[] = []
  let headerLabels: string[] = []

  if (customHeaders && customHeaders.length > 0) {
    headerKeys = customHeaders.map((h) => String(h.key))
    headerLabels = customHeaders.map((h) => h.label)
  } else {
    headerKeys = Object.keys(data[0])
    headerLabels = headerKeys
  }

  const rows: string[] = []

  // Linha de cabeçalho
  rows.push(headerLabels.map((h) => formatCsvField(h, delimiter)).join(delimiter))

  // Linhas de dados
  for (const item of data) {
    const rowValues = headerKeys.map((key) => formatCsvField(item[key], delimiter))
    rows.push(rowValues.join(delimiter))
  }

  return rows.join('\r\n')
}

/**
 * Faz o download de um arquivo CSV gerado no navegador com BOM UTF-8 e separador ponto e vírgula.
 */
export function downloadCsvFile(content: string, filename: string): void {
  // Adiciona BOM UTF-8 (\uFEFF) para garantir reconhecimento automático de acentos em pt-BR
  const blob = new Blob(['\uFEFF' + content], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  const safeFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  link.setAttribute('download', safeFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporta uma lista de objetos diretamente para arquivo CSV baixável.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  customHeaders?: { key: keyof T; label: string }[],
  delimiter = CSV_DELIMITER,
): boolean {
  if (!data || data.length === 0) {
    return false
  }

  const csvContent = generateCsvContent(data, customHeaders, delimiter)
  downloadCsvFile(csvContent, filename)
  return true
}
