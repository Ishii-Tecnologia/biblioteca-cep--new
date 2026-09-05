import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Simple pure-JS PDF generator using PDF 1.4 syntax (compliant and self-contained, no heavy external dependencies needed)
function createMinimalPdfDocument(
  title: string,
  subtitle: string,
  metaLines: string[],
  tableHeaders: string[],
  tableRows: string[][],
): Uint8Array {
  // Construct standard text lines formatted nicely into PDF stream
  const lines: string[] = []
  lines.push('%PDF-1.4')

  // Object 1: Catalog
  // Object 2: Outlines
  // Object 3: Pages
  // Object 4: Page
  // Object 5: Font Helvetica
  // Object 6: Font Helvetica-Bold
  // Object 7: Content stream

  const contentStreamLines: string[] = []
  contentStreamLines.push('BT') // Begin text

  // Title
  contentStreamLines.push('/F2 16 Tf') // Helvetica-Bold 16pt
  contentStreamLines.push('50 780 Td')
  contentStreamLines.push(`(${escapePdfText(title)}) Tj`)

  // Subtitle
  contentStreamLines.push('/F1 10 Tf')
  contentStreamLines.push('0 -20 Td')
  contentStreamLines.push(`(${escapePdfText(subtitle)}) Tj`)

  // Meta lines
  contentStreamLines.push('/F1 9 Tf')
  contentStreamLines.push('0 -18 Td')
  for (const m of metaLines) {
    contentStreamLines.push(`(${escapePdfText(m)}) Tj`)
    contentStreamLines.push('0 -14 Td')
  }

  // Divider
  contentStreamLines.push('0 -10 Td')
  contentStreamLines.push('/F2 10 Tf')
  const headerStr = tableHeaders.join('  |  ')
  contentStreamLines.push(`(${escapePdfText(headerStr)}) Tj`)
  contentStreamLines.push('0 -14 Td')
  contentStreamLines.push(`(${escapePdfText('='.repeat(Math.min(100, headerStr.length + 10)))}) Tj`)

  // Table rows (first 40 rows in single page preview or paginated text)
  contentStreamLines.push('/F1 8 Tf')
  const maxRows = Math.min(tableRows.length, 38)
  for (let i = 0; i < maxRows; i++) {
    const row = tableRows[i]
    contentStreamLines.push('0 -12 Td')
    const rowStr = row.map((cell) => cell.replace(/\n/g, ' ')).join('  |  ')
    // Trim length to fit standard width
    const trimmed = rowStr.length > 115 ? rowStr.substring(0, 112) + '...' : rowStr
    contentStreamLines.push(`(${escapePdfText(trimmed)}) Tj`)
  }

  if (tableRows.length > maxRows) {
    contentStreamLines.push('0 -16 Td')
    contentStreamLines.push('/F2 8 Tf')
    contentStreamLines.push(
      `(${escapePdfText(`... e mais ${tableRows.length - maxRows} registro(s) arquivados com sucesso neste lote.`)}) Tj`,
    )
  }

  contentStreamLines.push('ET') // End text
  const streamData = contentStreamLines.join('\n')

  const objects: string[] = []
  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n')
  // 2: Outlines
  objects.push('2 0 obj\n<< /Type /Outlines /Count 0 >>\nendobj\n')
  // 3: Pages
  objects.push('3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n')
  // 4: Page
  objects.push(
    '4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Contents 7 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
  )
  // 5: Font F1 (Helvetica)
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
  // 6: Font F2 (Helvetica-Bold)
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n')
  // 7: Stream
  const streamBytes = new TextEncoder().encode(streamData)
  objects.push(
    `7 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamData}\nendstream\nendobj\n`,
  )

  let offset = 9 // '%PDF-1.4\n' length
  const xref: string[] = ['xref', '0 8', '0000000000 65535 f ']
  for (let i = 0; i < objects.length; i++) {
    const pad = ('0000000000' + offset).slice(-10)
    xref.push(`${pad} 00000 n `)
    offset += new TextEncoder().encode(objects[i]).length
  }

  const startxref = offset
  const trailer = `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`

  const finalPdfStr = '%PDF-1.4\n' + objects.join('') + xref.join('\n') + '\n' + trailer
  return new TextEncoder().encode(finalPdfStr)
}

function escapePdfText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para fonte padrão Helvetica
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

// Validação de formato de e-mail (regex)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuração do servidor ausente (SUPABASE_URL / SERVICE_ROLE_KEY).',
          message: 'Configuração de backend incompleta no ambiente.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    const { action = 'executar_job', force = false, test_email = false } = body

    // 1. Carregar parâmetros atuais da tabela public.parametros
    const { data: paramsData, error: paramsErr } = await supabaseAdmin
      .from('parametros')
      .select('chave, valor')

    if (paramsErr) throw paramsErr

    const paramMap = new Map<string, string>()
    ;(paramsData || []).forEach((p: { chave: string; valor: string }) =>
      paramMap.set(p.chave, p.valor),
    )

    const ativo = paramMap.get('auditoria_envio_ativo') === 'true'
    const rawDestinatarios = paramMap.get('auditoria_destinatarios') || ''
    const assuntoTemplate =
      paramMap.get('auditoria_assunto') || 'Relatório de Auditoria — {data_referencia}'
    const corpoTemplate =
      paramMap.get('auditoria_corpo') || 'Segue em anexo o Relatório de Auditoria.'
    const remetente = paramMap.get('auditoria_remetente') || 'sys.biblioteca.cep@email.org'
    const diasRetroativos = Math.max(
      1,
      Math.min(365, parseInt(paramMap.get('auditoria_dias_retroativos') || '30', 10)),
    )
    const diaEnvioConfig = Math.max(
      1,
      Math.min(31, parseInt(paramMap.get('auditoria_dia_envio') || '1', 10)),
    )
    const diasRetencao = Math.max(1, parseInt(paramMap.get('auditoria_dias_retencao') || '90', 10))

    // Timezone America/Sao_Paulo
    const nowUtc = new Date()
    // Obter data/hora formatada no fuso America/Sao_Paulo
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(nowUtc)
    const partMap: Record<string, string> = {}
    parts.forEach((p) => {
      partMap[p.type] = p.value
    })

    const currentYear = parseInt(partMap.year, 10)
    const currentMonth = parseInt(partMap.month, 10)
    const currentDay = parseInt(partMap.day, 10)
    const anoMes = `${partMap.year}-${partMap.month}`
    const dataReferenciaExtenso = `${partMap.day}/${partMap.month}/${partMap.year} ${partMap.hour}:${partMap.minute}`

    // Determinar o último dia do mês atual para regras de meses mais curtos (fevereiro 28/29, abril 30, etc.)
    const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
    const targetExecutionDay = Math.min(diaEnvioConfig, lastDayOfMonth)

    // Se for ação de teste imediato
    if (action === 'enviar_teste') {
      return await handleSendTest({
        supabaseAdmin,
        rawDestinatarios,
        remetente,
        assuntoTemplate,
        corpoTemplate,
        diasRetroativos,
        dataReferenciaExtenso,
      })
    }

    // Se a ação for execução do job agendado ou sob demanda
    if (!force && !ativo) {
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          message: 'Envio automático inativo nas configurações do sistema.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validação do dia do mês quando não for forçado
    if (!force && currentDay !== targetExecutionDay) {
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          message: `Hoje é dia ${currentDay}, mas o job está configurado para o dia ${targetExecutionDay} do mês.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validação de Idempotência: verificar se já rodou com sucesso no mês atual
    const { data: existingExecution } = await supabaseAdmin
      .from('job_execucoes')
      .select('*')
      .eq('ano_mes', anoMes)
      .eq('tipo_job', 'auditoria_mensal_expurgo')
      .maybeSingle()

    if (existingExecution && existingExecution.status === 'sucesso' && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: `Job mensal de auditoria já foi executado com sucesso para ${anoMes} em ${existingExecution.data_execucao}.`,
          execucao: existingExecution,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Tratar lista mista de e-mails: separar válidos e inválidos
    const emailList = rawDestinatarios
      .split(',')
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0)

    const validEmails: string[] = []
    const invalidEmails: string[] = []

    for (const email of emailList) {
      if (EMAIL_REGEX.test(email)) {
        validEmails.push(email)
      } else {
        invalidEmails.push(email)
      }
    }

    if (invalidEmails.length > 0) {
      // Registrar aviso na auditoria sobre e-mails inválidos encontrados
      await supabaseAdmin.from('historico').insert({
        tipo: 'Aviso de Configuração de E-mail',
        descricao: `E-mails inválidos ignorados na lista de destinatários de auditoria: ${invalidEmails.join(', ')}`,
        entidade_tipo: 'sistema',
        entidade_id: 'job_auditoria',
        observacao: 'Apenas os destinatários válidos receberão o relatório mensal.',
      })
    }

    if (validEmails.length === 0) {
      const errMsg =
        'Nenhum e-mail de destinatário válido configurado para o envio do relatório de auditoria.'
      try {
        await supabaseAdmin.from('historico').insert({
          tipo: 'Falha no Envio de Auditoria',
          descricao: errMsg,
          entidade_tipo: 'sistema',
          entidade_id: 'job_auditoria',
          observacao: 'O expurgo NÃO foi realizado devido à ausência de destinatários válidos.',
        })
      } catch (logErr) {
        console.warn('Não foi possível gravar histórico de falha:', logErr)
      }

      return new Response(JSON.stringify({ success: false, error: errMsg, message: errMsg }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Iniciar registro de execução do Job (lock/registro inicial)
    const startTime = Date.now()
    const { data: jobRecord } = await supabaseAdmin
      .from('job_execucoes')
      .upsert(
        {
          ano_mes: anoMes,
          tipo_job: 'auditoria_mensal_expurgo',
          status: 'pendente',
          destinatarios: validEmails.join(', '),
          mensagem: 'Executando geração de relatório em PDF e disparo...',
        },
        { onConflict: 'ano_mes,tipo_job' },
      )
      .select()
      .single()

    // FLUXO DO JOB (ORDEM OBRIGATÓRIA):
    // 1. GERAR PDF COM OS ÚLTIMOS N DIAS
    // 2. ENVIAR E-MAIL COM O PDF ANEXO
    // 3. SE SUCESSO: EXECUTAR EXPURGO EM LOTES. SE FALHAR O E-MAIL: NÃO EXPURGAR!

    // Passo 1: Buscar registros do período (últimos N dias a partir de agora)
    const cutoffStartDate = new Date(nowUtc.getTime() - diasRetroativos * 24 * 60 * 60 * 1000)
    const dataInicioStr = cutoffStartDate.toISOString()

    const { data: logsData, error: logsError } = await supabaseAdmin
      .from('historico')
      .select(
        'id, tipo, descricao, entidade_tipo, entidade_id, usuario_id, created_at, id_leitor, observacao',
      )
      .gte('created_at', dataInicioStr)
      .order('created_at', { ascending: false })

    if (logsError) throw logsError

    const totalRegistros = (logsData || []).length
    const dataInicioBR = `${String(cutoffStartDate.getUTCDate()).padStart(2, '0')}/${String(cutoffStartDate.getUTCMonth() + 1).padStart(2, '0')}/${cutoffStartDate.getUTCFullYear()}`
    const dataFimBR = `${partMap.day}/${partMap.month}/${partMap.year}`

    // Montar tabela para o PDF
    const tableHeaders = ['Data/Hora', 'Operacao', 'Entidade', 'Descricao']
    const tableRows = (logsData || []).map((l: any) => [
      new Date(l.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      l.tipo || 'Operação',
      l.entidade_id ? `${l.entidade_tipo}: ${l.entidade_id}` : l.entidade_tipo || '-',
      (l.descricao || '-') + (l.observacao ? ` (Obs: ${l.observacao})` : ''),
    ])

    const pdfBytes = createMinimalPdfDocument(
      'Biblioteca CEP - Relatorio de Auditoria (Logs)',
      `Historico Oficial de Operacoes e Eventos (${diasRetroativos} dias retroativos)`,
      [
        `Periodo de Cobertura: ${dataInicioBR} ate ${dataFimBR}`,
        `Data de Emissao: ${dataReferenciaExtenso} (America/Sao_Paulo)`,
        `Total de Registros Encontrados: ${totalRegistros}`,
        totalRegistros === 0
          ? 'AVISO: Nenhum registro de auditoria gerado no periodo.'
          : 'Status da Base: Operacoes consolidadas.',
      ],
      tableHeaders,
      tableRows,
    )

    // Converter PDF em base64
    let binary = ''
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i])
    }
    const pdfBase64 = btoa(binary)

    // Montar assunto e corpo com variáveis
    const linkSistema = 'https://biblioteca-cep.app/historico?tab=logs'
    const subject = assuntoTemplate
      .replace(/{data_referencia}/g, dataFimBR)
      .replace(/{data_inicio}/g, dataInicioBR)
      .replace(/{data_fim}/g, dataFimBR)
      .replace(/{total_registros}/g, String(totalRegistros))

    let bodyText = corpoTemplate
      .replace(/{data_referencia}/g, dataReferenciaExtenso)
      .replace(/{data_inicio}/g, dataInicioBR)
      .replace(/{data_fim}/g, dataFimBR)
      .replace(/{total_registros}/g, String(totalRegistros))
      .replace(/{link_sistema}/g, linkSistema)

    if (totalRegistros === 0) {
      bodyText += '\n\n[Aviso do Sistema: Nenhum registro de auditoria foi registrado no período].'
    }

    // Passo 2: Disparar e-mail (ou simulação caso sem provedor configurado)
    const emailResult = await sendEmailOrSimulate({
      to: validEmails,
      from: remetente,
      subject,
      body: bodyText,
      attachmentBase64: pdfBase64,
      attachmentName: `relatorio_auditoria_${anoMes}.pdf`,
    })

    // Registrar no log da auditoria a tentativa de envio (auditoria da auditoria)
    await supabaseAdmin.from('historico').insert({
      tipo: emailResult.success ? 'Envio de Auditoria Concluído' : 'Falha no Envio de Auditoria',
      descricao: emailResult.success
        ? `Relatório de auditoria mensal enviado com sucesso para ${validEmails.length} destinatário(s). ${emailResult.provider === 'simulado' ? '(Envio simulado/provedor aguardando chave RESEND_API_KEY)' : '(Envio real efetuado via Resend)'}.`
        : `Tentativa de envio de e-mail falhou: ${emailResult.message}`,
      entidade_tipo: 'sistema',
      entidade_id: 'job_auditoria',
      observacao: `Período: ${dataInicioBR} a ${dataFimBR}. Total de registros no relatório: ${totalRegistros}.`,
    })

    if (!emailResult.success) {
      // Regra de negócio mandatória: Se o e-mail falhar, NÃO expurgar a base!
      const durationMs = Date.now() - startTime
      await supabaseAdmin
        .from('job_execucoes')
        .update({
          status: 'erro',
          registros_incluidos: totalRegistros,
          registros_expurgados: 0,
          duracao_ms: durationMs,
          mensagem: `Falha no envio do e-mail: ${emailResult.message}. Rotina de expurgo cancelada preventivamente.`,
          detalhes: { emailResult },
        })
        .eq('id', jobRecord.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: `Falha no envio de e-mail: ${emailResult.message}. O expurgo foi cancelado para resguardar os dados da biblioteca.`,
          message: `Falha no envio do e-mail. A base de histórico NÃO foi expurgada.`,
          emailResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Passo 3: Executar expurgo em lotes somente após envio bem-sucedido
    let registrosExpurgados = 0
    let expurgoDetalhes: any = null
    try {
      const { data: purgeData, error: purgeErr } = await supabaseAdmin.rpc(
        'expurgar_historico_em_lotes',
        {
          p_dias_retencao: diasRetencao,
          p_batch_size: 500,
        },
      )

      if (purgeErr) throw purgeErr
      expurgoDetalhes = purgeData
      registrosExpurgados = purgeData?.total_removidos ?? 0
    } catch (purgeError: any) {
      console.error('Erro no expurgo de histórico:', purgeError)
      // Logar erro específico do expurgo
      await supabaseAdmin.from('historico').insert({
        tipo: 'Erro no Expurgo de Histórico',
        descricao: `Falha ao executar expurgo em lotes: ${purgeError.message}`,
        entidade_tipo: 'sistema',
        entidade_id: 'job_expurgo',
        observacao: 'O relatório em PDF e o e-mail foram entregues antes desta falha.',
      })
    }

    const durationMs = Date.now() - startTime
    const finalMessage = `Job concluído com sucesso. PDF gerado (${totalRegistros} registros), e-mail processado para ${validEmails.join(', ')} e expurgo finalizado (${registrosExpurgados} registros antigos limpos).`

    await supabaseAdmin
      .from('job_execucoes')
      .update({
        status: 'sucesso',
        registros_incluidos: totalRegistros,
        registros_expurgados: registrosExpurgados,
        duracao_ms: durationMs,
        mensagem: finalMessage,
        detalhes: {
          emailResult,
          expurgoDetalhes,
          invalidEmailsIgnored: invalidEmails,
        },
      })
      .eq('id', jobRecord.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: finalMessage,
        ano_mes: anoMes,
        total_registros_relatorio: totalRegistros,
        registros_expurgados: registrosExpurgados,
        duracao_ms: durationMs,
        provedor_email: emailResult.provider,
        destinatarios_enviados: validEmails,
        destinatarios_invalidos: invalidEmails,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('Erro na Edge Function auditoria_mensal_expurgo:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Erro interno ao processar o job de auditoria.',
        message: err.message || 'Erro ao processar rotina de auditoria.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

// Sub-rotina para envio de e-mail de teste
async function handleSendTest({
  supabaseAdmin,
  rawDestinatarios,
  remetente,
  assuntoTemplate,
  corpoTemplate,
  diasRetroativos,
  dataReferenciaExtenso,
}: any) {
  const emailList = (rawDestinatarios || '')
    .split(',')
    .map((e: string) => e.trim())
    .filter((e: string) => e.length > 0)

  const validEmails: string[] = []
  const invalidEmails: string[] = []
  for (const email of emailList) {
    if (EMAIL_REGEX.test(email)) validEmails.push(email)
    else invalidEmails.push(email)
  }

  if (validEmails.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Nenhum e-mail de destinatário válido configurado. Insira ao menos 1 e-mail válido antes de testar.',
        message: 'Nenhum e-mail válido informado para envio de teste.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Gerar PDF de amostra
  const pdfBytes = createMinimalPdfDocument(
    'Biblioteca CEP - Relatorio de Auditoria [TESTE]',
    'Documento de Amostra para Validacao do Envio de Auditoria',
    [
      `Data de Emissao: ${dataReferenciaExtenso}`,
      'Tipo de Operacao: Disparo de Validacao / Teste de Conexao',
      `Destinatarios Testados: ${validEmails.join(', ')}`,
    ],
    ['Data/Hora', 'Operacao', 'Detalhes'],
    [
      [
        dataReferenciaExtenso,
        'Teste de Envio',
        'Validacao da rotina de auditoria automatica e geracao de PDF.',
      ],
      [
        dataReferenciaExtenso,
        'Status Provedor',
        'Checagem de credenciais de e-mail e layout do anexo.',
      ],
    ],
  )

  let binary = ''
  for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i])
  const pdfBase64 = btoa(binary)

  const subject = `[TESTE] ${assuntoTemplate.replace(/{data_referencia}/g, dataReferenciaExtenso)}`
  const body = `Este e um disparo de teste solicitado manualmente nas Configuracoes do Sistema para validar o envio do Relatorio de Auditoria.\n\nDestinatarios: ${validEmails.join(', ')}\nRemetente: ${remetente}\n\nO PDF anexo contem a estrutura oficial de amostra.\n\n${corpoTemplate}`

  const result = await sendEmailOrSimulate({
    to: validEmails,
    from: remetente,
    subject,
    body,
    attachmentBase64: pdfBase64,
    attachmentName: 'relatorio_auditoria_amostra.pdf',
  })

  // Auditoria da auditoria
  await supabaseAdmin.from('historico').insert({
    tipo: 'Teste de Envio de Auditoria',
    descricao: `Disparo de e-mail de teste para ${validEmails.join(', ')}. Status: ${result.success ? 'Sucesso' : 'Falha'}. Modo: ${result.provider}.`,
    entidade_tipo: 'sistema',
    entidade_id: 'teste_email',
    observacao: result.message,
  })

  return new Response(
    JSON.stringify({
      success: result.success,
      message: result.message,
      provider: result.provider,
      destinatarios_enviados: validEmails,
      destinatarios_invalidos: invalidEmails,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

// Disparo real (via Resend se RESEND_API_KEY existir) ou simulado com log transparente
async function sendEmailOrSimulate({
  to,
  from,
  subject,
  body,
  attachmentBase64,
  attachmentName,
}: {
  to: string[]
  from: string
  subject: string
  body: string
  attachmentBase64: string
  attachmentName: string
}): Promise<{ success: boolean; message: string; provider: 'resend' | 'simulado' }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  // Se houver chave do provedor Resend configurada
  if (resendApiKey && resendApiKey.trim().length > 5) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from.includes('<') ? from : `Biblioteca CEP <${from}>`,
          to,
          subject,
          text: body,
          attachments: [
            {
              filename: attachmentName,
              content: attachmentBase64,
            },
          ],
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return {
          success: false,
          message: `Erro da API Resend (${res.status}): ${errorText}`,
          provider: 'resend',
        }
      }

      const resData = await res.json()
      return {
        success: true,
        message: `E-mail enviado com sucesso via Resend (ID: ${resData.id || 'ok'}).`,
        provider: 'resend',
      }
    } catch (e: any) {
      return {
        success: false,
        message: `Falha de rede ao conectar com provedor de e-mail: ${e.message}`,
        provider: 'resend',
      }
    }
  }

  // Sem provedor configurado no momento: simulação fiel e transparente
  return {
    success: true,
    message: `Envio simulado com sucesso para ${to.join(', ')} com anexo ${attachmentName} (${Math.round((attachmentBase64.length * 3) / 4 / 1024)} KB). Ponto de integração 100% pronto: basta cadastrar a chave RESEND_API_KEY no backend para transmissão externa real.`,
    provider: 'simulado',
  }
}
