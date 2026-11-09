/**
 * Serviço Inteligente de Extração e Interpretação de PDFs de Fornecedores da SABRAR
 * Suporta formatos diversos de orçamentos, cotações e propostas comerciais (ex: Multistar, Polar, Dufrio, Climatização, Leveros, Protshop, etc.)
 */
export class SupplierPdfParser {
  /**
   * Converte texto extraído de PDF em dados estruturados de proposta/orçamento
   */
  static parse(text) {
    if (!text || typeof text !== 'string') {
      return {
        supplier: {},
        proposal: {},
        items: [],
        totals: {}
      };
    }

    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Extração de Metadados do Fornecedor
    const supplier = this.extractSupplierInfo(cleanText, lines);

    // 2. Extração de Dados da Proposta / Orçamento
    const proposal = this.extractProposalInfo(cleanText, lines);

    // 3. Extração dos Itens Cotados (Multi-Estratégia)
    const items = this.extractItems(cleanText, lines);

    // 4. Totais e Condições Comerciais
    const totals = this.extractTotals(cleanText, lines, items);

    return {
      supplier,
      proposal,
      items,
      totals
    };
  }

  static parseBrNumber(valStr) {
    if (!valStr) return 0;
    const clean = String(valStr).replace(/[R$\sBRL]/gi, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (clean.includes(',')) {
      return parseFloat(clean.replace(',', '.')) || 0;
    }
    return parseFloat(clean) || 0;
  }

  static extractSupplierInfo(text, lines) {
    let name = '';
    let cnpj = '';
    let phone = '';
    let email = '';
    let contactPerson = '';

    // CNPJ: busca padrão XX.XXX.XXX/XXXX-XX
    // Exclui CNPJs de clientes / Sabrar (40.417.156 e Stanque Dutos 42.763.452)
    const cnpjMatches = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
    const nonBuyerCnpjs = cnpjMatches.filter(c => !c.includes('40.417.156') && !c.includes('42.763.452'));
    if (nonBuyerCnpjs.length > 0) {
      cnpj = nonBuyerCnpjs[0];
    } else if (cnpjMatches.length > 0) {
      cnpj = cnpjMatches[0];
    }

    // Email do fornecedor
    const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const nonSabrarEmail = emailMatches.filter(e => !e.toLowerCase().includes('sabrar.com.br') && !e.toLowerCase().includes('stanquedutos.com'));
    if (nonSabrarEmail.length > 0) {
      email = nonSabrarEmail[0];
    }

    // Telefone / Celular / Whatsapp com suporte a DDD completo
    const phoneMatches = text.match(/(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-\s]?\d{4}/g) || [];
    const validPhones = phoneMatches.filter(p => !p.includes('2557-4864'));
    if (validPhones.length > 0) {
      phone = validPhones[0];
    }
    const whatsappMatch = text.match(/whatsapp\s*[:]?\s*([^\n\r]+)/i);
    if (whatsappMatch) {
      phone = whatsappMatch[1].trim();
    }

    // Nome da Empresa Fornecedora (procura linha com razão social / nome fantasia)
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (
        (upper.includes('LTDA') || upper.includes('EIRELI') || upper.includes('S.A.') || upper.includes('S/A') || /\bME\b/.test(upper) || upper.includes('EQUIP') || upper.includes('DISTRIBUIDORA') || upper.includes('COMERCIO') || upper.includes('COMÉRCIO') || upper.includes('REFRIGERACAO') || upper.includes('REFRIGERAÇÃO') || upper.includes('COMPONENTES') || upper.includes('INDUS')) &&
        !upper.includes('SABRAR') &&
        !upper.includes('STANQUE') &&
        !upper.includes('ORÇAMENTO') &&
        !upper.includes('ORCAMENTO') &&
        !upper.includes('ENDEREÇO') &&
        !upper.includes('AVENIDA') &&
        !upper.includes('RUA')
      ) {
        name = line.replace(/^(Nome|Razão Social|Fornecedor|Empresa)\s*[:]?\s*/i, '').trim();
        break;
      }
    }

    if (!name && email) {
      const domain = email.split('@')[1]?.replace(/\.com.*$/, '');
      if (domain) name = domain.toUpperCase();
    }

    // Vendedor / Contato
    const vendMatch = text.match(/vendedor(?:a)?\s*[\n\r:]*\s*(?:[0-9]{3,5}\s*-\s*)?([A-Za-zÀ-ÿ]{3,}(?:\s+[A-Za-zÀ-ÿ]+)?)/i);
    if (vendMatch && !vendMatch[1].toUpperCase().includes('FORMA') && !vendMatch[1].toUpperCase().includes('VALOR')) {
      contactPerson = vendMatch[1].trim();
    }

    return {
      name: name || 'Fornecedor',
      cnpj,
      phone,
      email,
      contactPerson
    };
  }

  static extractProposalInfo(text, lines) {
    let proposalNumber = '';
    let emissionDate = '';
    let paymentTerms = '';
    let deliveryTime = '';

    const numMatch = text.match(/(?:orçamento|orcamento|proposta|proposta comercial|pedido|cotação|cotacao|nº|numero|num)\s*(?:nº|n°|no|\.)?\s*[:]?\s*([0-9A-Za-z\-_/]+)/i);
    if (numMatch && numMatch[1].length >= 2 && !/código|codigo|comercial/i.test(numMatch[1])) {
      proposalNumber = numMatch[1].trim();
    } else {
      const propSec = text.match(/(?:proposta comercial|orçamento|orcamento)\s*(?:nº|n°|no)?\s*[:]?\s*([0-9A-Za-z\-_/]+)/i);
      if (propSec && propSec[1]) proposalNumber = propSec[1].trim();
    }

    const dateMatch = text.match(/(?:emiss[aã]o|data)\s*[:]?\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                      text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    if (dateMatch) {
      emissionDate = dateMatch[1];
    }

    const payMatch = text.match(/(?:Condição de Pagamento|Cond\. Pagto|Forma de Pagamento|Pagamento)\s*[:]?\s*([^\n\r]+)/i) ||
                     text.match(/(?:Dinheiro\s*\/\s*Pagamento à vista|Faturado\s*\d+\s*DD|Boleto\s*\d+\s*DD|\d+\s*DDL(?:\s*Boleto)?|À Vista|A Vista|Pix)/i);
    if (payMatch) {
      paymentTerms = (payMatch[1] || payMatch[0]).split(/(?:Entrega|Vendedor|Emissão)/i)[0].trim();
    }

    const delivObsMatch = text.match(/prazo de entrega\s*[:]\s*([^\n\r]+)/i);
    if (delivObsMatch) {
      deliveryTime = delivObsMatch[1].trim();
    } else {
      const deliveryMatch = text.match(/(?:prazo de entrega|entrega)\s*[:\.]*\s*([^\n\r]+)/i);
      if (deliveryMatch) {
        deliveryTime = deliveryMatch[1].replace(/^[.:\s]+/, '').trim();
      }
    }

    return {
      proposalNumber: proposalNumber || `COT-${Date.now().toString().slice(-6)}`,
      emissionDate: emissionDate || new Date().toLocaleDateString('pt-BR'),
      paymentTerms: paymentTerms || 'A combinar / Conforme proposta',
      deliveryTime: deliveryTime || 'Imediata'
    };
  }

  static extractTotals(text, lines, items) {
    let totalGeneral = 0;
    let freight = 0;
    let discount = 0;

    const totalMatch = text.match(/(?:Total Geral|Valor Total|Total da Proposta|Total do Pedido)\s*[:]?\s*(?:R\$\s*)?([\d.,]+)/i) ||
                       text.match(/(?:total)\s*[:]?\s*(?:R\$\s*)?([\d.,]+)/i);
    if (totalMatch) {
      totalGeneral = this.parseBrNumber(totalMatch[1]);
    } else if (items.length > 0) {
      totalGeneral = items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
    }

    const freightMatch = text.match(/frete\s*[:]?\s*(?:R\$\s*)?([\d.,]+)/i);
    if (freightMatch) freight = this.parseBrNumber(freightMatch[1]);

    const descMatch = text.match(/desconto\s*[:]?\s*(?:R\$\s*)?([\d.,]+)/i);
    if (descMatch) discount = this.parseBrNumber(descMatch[1]);

    return {
      totalGeneral: Number(totalGeneral.toFixed(2)),
      freight: Number(freight.toFixed(2)),
      discount: Number(discount.toFixed(2))
    };
  }

  static get UNITS() {
    return [
      'PR', 'PAR', 'PARES', 'UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES',
      'PC', 'PÇ', 'PÇA', 'PÇS', 'PEÇA', 'PEÇAS', 'CX', 'CXS', 'CAIXA', 'CAIXAS',
      'M', 'MT', 'MTR', 'MTS', 'METRO', 'METROS', 'KG', 'KGS', 'QUILO', 'QUILOS',
      'L', 'LT', 'LTS', 'LITRO', 'LITROS', 'RL', 'ROLO', 'ROLOS', 'FD', 'FARDO',
      'TB', 'TUBO', 'TUBOS', 'VB', 'CJ', 'CONJ', 'JG', 'JOGO', 'BARRA', 'BARRAS',
      'BR', 'CENTO', 'CENTOS', 'KIT', 'KITS', 'PCT', 'PACOTE', 'BTL', 'BOT', 'BOTIJA',
      'LATA', 'LATAS', 'TAMBOR'
    ];
  }

  static isIgnoredLine(line) {
    const l = line.toUpperCase();
    return (
      l.includes('CNPJ:') ||
      l.includes('C.N.P.J') ||
      l.includes('CPF:') ||
      l.includes('C.P.F') ||
      l.includes('INSCRIÇÃO') ||
      l.includes('INSC. ESTADUAL') ||
      l.includes('I.E.:') ||
      l.includes('I.E.') ||
      l.includes('C.E.P.') ||
      l.includes('CEP:') ||
      l.includes('TELEFONE') ||
      l.includes('FONE:') ||
      l.includes('TEL:') ||
      l.includes('EMAIL:') ||
      l.includes('E-MAIL:') ||
      l.includes('CONDIÇÃO DE PAGAMENTO') ||
      l.includes('COND. PAGTO') ||
      l.includes('FORMA DE PAGAMENTO') ||
      l.includes('PROPOSTA COMERCIAL Nº') ||
      l.includes('ORÇAMENTO Nº') ||
      l.includes('ORCAMENTO Nº') ||
      l.includes('TOTAL GERAL') ||
      l.includes('SUB TOTAL') ||
      l.includes('SUB-TOTAL') ||
      l.includes('SUBTOTAL') ||
      l.includes('AGRADECEMOS') ||
      l.includes('DADOS BANCÁRIOS') ||
      l.includes('BANCO:') ||
      l.includes('AGÊNCIA:') ||
      l.includes('VALIDADE DA PROPOSTA') ||
      l.includes('PREÇOS AJUSTÁVEIS') ||
      l.includes('PRECOS AJUSTAVEIS') ||
      l.includes('NOSSOS PREÇOS SÃO') ||
      l.includes('NOSSOS PRECOS SAO') ||
      l.includes('OBSERVAÇÕES:') ||
      l.includes('OBSERVACOES:') ||
      l.includes('ENDEREÇO:') ||
      l.includes('ENDERECO:') ||
      l.includes('CIDADE:') ||
      l.includes('BAIRRO:') ||
      l.includes('ESTADO:') ||
      l.includes('CLIENTE:') ||
      l.includes('DESTINATÁRIO:') ||
      l.includes('VENDEDOR:') ||
      /^ITEM\s+CÓDIGO/i.test(l) ||
      /^ITEM\s+DESCRIÇÃO/i.test(l) ||
      /^CÓDIGO\s+DESCRIÇÃO/i.test(l) ||
      /^CODIGO\s+DESCRICAO/i.test(l) ||
      /^DESCRIÇÃO\s+DO/i.test(l)
    );
  }

  /**
   * Localiza a região exata da tabela de itens (Zone B) entre o cabeçalho e o rodapé/totais
   */
  static findTableZones(lines) {
    let headerIndex = -1;
    let footerIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();

      // Identifica linha de cabeçalho da tabela de itens
      if (headerIndex === -1) {
        const hasCodeOrItem = l.includes('código') || l.includes('codigo') || l.includes('item') || l.includes('ref');
        const hasDesc = l.includes('descrição') || l.includes('descricao') || l.includes('produto') || l.includes('material');
        const hasQty = l.includes('qtde') || l.includes('qtd') || l.includes('quant') || l.includes('unid') || l.includes('un.');
        const hasPrice = l.includes('unitário') || l.includes('unitario') || l.includes('total') || l.includes('preço') || l.includes('preco') || l.includes('valor');

        if ((hasDesc && (hasPrice || hasQty)) || (hasCodeOrItem && hasDesc)) {
          headerIndex = i;
          continue;
        }
      }

      // Identifica rodapé / encerramento da tabela
      if (headerIndex !== -1 && i > headerIndex) {
        if (
          l.startsWith('preços ajustáveis') ||
          l.startsWith('precos ajustaveis') ||
          l.includes('nossos preços são') ||
          l.includes('nossos precos sao') ||
          l.includes('observações') ||
          l.includes('observacoes') ||
          l.includes('sub-total') ||
          l.includes('subtotal') ||
          l.includes('total geral') ||
          l.includes('total ipi') ||
          l.includes('total dos produtos') ||
          l.includes('dados bancários') ||
          l.includes('dados bancarios') ||
          l.includes('condições gerais') ||
          l.includes('condicoes gerais') ||
          l.includes('validade da proposta')
        ) {
          footerIndex = i;
          break;
        }
      }
    }

    return { headerIndex, footerIndex };
  }

  /**
   * Extração de itens em tabelas de cotação / orçamentos multi-estratégia
   */
  static extractItems(text, lines) {
    const zones = this.findTableZones(lines);
    const candidateLines = zones.headerIndex !== -1
      ? lines.slice(zones.headerIndex + 1, zones.footerIndex)
      : lines;

    // 1. Linhas com delimitadores explícitos (pipes | ou tabs \t)
    const delimited = this.extractDelimitedRows(candidateLines);
    if (delimited.length > 0) return delimited;

    // 2. Linhas tabulares tradicionais (com descrição, quantidade, preços)
    const tableItems = this.extractTableRows(candidateLines);
    if (tableItems.length > 0) return tableItems;

    // 3. Blocos multi-linhas (quando cada atributo quebra de linha)
    const blockItems = this.extractMultiLineBlocks(candidateLines);
    if (blockItems.length > 0) return blockItems;

    // 4. Glued numbers (Protshop)
    const glued = this.extractGluedItems(candidateLines);
    if (glued.length > 0) return glued;

    // Fallback se com delimitação restrita não achou nada (orçamentos sem cabeçalho padronizado)
    if (zones.headerIndex !== -1) {
      const fallbackTable = this.extractTableRows(lines);
      if (fallbackTable.length > 0) return fallbackTable;
    }

    return [];
  }

  static extractDelimitedRows(lines) {
    const items = [];
    for (const line of lines) {
      if (!line.includes('|') && !line.includes('\t') && !line.includes(';')) continue;
      if (this.isIgnoredLine(line)) continue;

      const sep = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ';';
      const cells = line.split(sep).map(c => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;

      let unitPrice = 0;
      let totalPrice = 0;
      let quantity = 0;
      let unit = 'UN';
      let description = '';
      let code = '';

      for (let cIdx = cells.length - 1; cIdx >= 0; cIdx--) {
        const raw = cells[cIdx];
        const val = this.parseBrNumber(raw);
        if (val > 0 && /[\d]+[.,]\d{2,4}/.test(raw)) {
          if (totalPrice === 0) {
            totalPrice = val;
          } else if (unitPrice === 0) {
            unitPrice = val;
          }
        } else if (quantity === 0 && /^[\d]+(?:[.,]\d+)?$/.test(raw)) {
          quantity = this.parseBrNumber(raw);
        } else if (this.UNITS.includes(raw.toUpperCase())) {
          unit = raw.toUpperCase();
        } else if (!description && raw.length > 3 && !/^\d+$/.test(raw)) {
          description = raw;
        } else if (!code && /^[A-Za-z0-9_.\-]{3,}$/.test(raw)) {
          code = raw;
        }
      }

      if (description && (unitPrice > 0 || totalPrice > 0)) {
        if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
          unitPrice = Number((totalPrice / quantity).toFixed(2));
        } else if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
          totalPrice = Number((unitPrice * quantity).toFixed(2));
        } else if (quantity === 0 && unitPrice > 0 && totalPrice > 0) {
          quantity = Math.max(1, Math.round(totalPrice / unitPrice));
        }

        items.push({
          seq: items.length + 1,
          code: code || `REF-${items.length + 1}`,
          name: description,
          description,
          quantity: quantity || 1,
          unit,
          unitPrice: Number(unitPrice.toFixed(2)),
          unit_price: Number(unitPrice.toFixed(2)),
          totalPrice: Number(totalPrice.toFixed(2)),
          total_price: Number(totalPrice.toFixed(2)),
          subtotal: Number(totalPrice.toFixed(2))
        });
      }
    }
    return items;
  }

  static extractTableRows(lines) {
    const items = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (this.isIgnoredLine(line)) continue;

      // Limpa do final da linha colunas extras como IPI (ex: "0%", "5%"), Alíquotas ou NCM (ex: "8415.90" ou "7411.10.10")
      let cleanLine = line
        .replace(/\s+\d{1,2}(?:,\d+)?%\s*$/, '') // remove IPI no final
        .replace(/\s+\b\d{4}\.\d{2}(?:\.\d{2})?\b\s*$/, '') // remove NCM no final
        .replace(/\s+\b\d{8}\b\s*$/, '') // remove NCM numérico
        .replace(/\s+\d{1,2}(?:,\d+)?%\s*$/, '') // se houver outro percentual
        .trim();

      // Procura números com 2 a 4 casas decimais (unitário e total)
      // Aceita tanto formato brasileiro tradicional com vírgula quanto formato internacional com ponto
      const priceRegex = /(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)[,.]\d{2,4})/g;
      const matches = [...cleanLine.matchAll(priceRegex)];

      if (matches.length < 2) continue;

      const lastMatch = matches[matches.length - 1];
      const prevMatch = matches[matches.length - 2];

      const valLast = this.parseBrNumber(lastMatch[1]);
      const valPrev = this.parseBrNumber(prevMatch[1]);

      let unitPrice = valPrev;
      let totalPrice = valLast;

      // Texto antes do preço unitário
      let leadText = cleanLine.slice(0, prevMatch.index).trim();

      let quantity = 0;
      let unit = 'UN';

      // Padrão 1: "04 PC" ou "10 UN" ou "15,00 MT" ou "1.000,00 CENTO" no final do leadText
      const qtyUnitEndMatch = leadText.match(/([\d]{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ]{1,6})\s*$/);
      if (qtyUnitEndMatch && this.UNITS.includes(qtyUnitEndMatch[2].toUpperCase())) {
        quantity = this.parseBrNumber(qtyUnitEndMatch[1]);
        unit = qtyUnitEndMatch[2].toUpperCase();
        leadText = leadText.slice(0, qtyUnitEndMatch.index).trim();
      } else {
        // Padrão 2: unidade em qualquer lugar no leadText precedida por número
        const anyUnitMatch = leadText.match(new RegExp(`([\\d]{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:[.,]\\d+)?)\\s*(${this.UNITS.join('|')})\\b`, 'i'));
        if (anyUnitMatch) {
          quantity = this.parseBrNumber(anyUnitMatch[1]);
          unit = anyUnitMatch[2].toUpperCase();
          leadText = leadText.slice(0, anyUnitMatch.index).trim();
        } else {
          // Padrão 3: quantidade numérica no final do leadText (ex: "1,000", "15,00" ou "1")
          const qtyOnlyMatch = leadText.match(/([\d]{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*$/);
          if (qtyOnlyMatch) {
            quantity = this.parseBrNumber(qtyOnlyMatch[1]);
            leadText = leadText.slice(0, qtyOnlyMatch.index).trim();
          }
        }
      }

      // Validação matemática
      if (quantity === 0 && unitPrice > 0 && totalPrice > 0) {
        quantity = Math.max(1, Math.round(totalPrice / unitPrice));
      }

      if (unitPrice > totalPrice && totalPrice > 0 && quantity > 1) {
        const temp = unitPrice;
        unitPrice = totalPrice;
        totalPrice = temp;
      }

      // Limpeza de código e descrição
      let cleanDesc = leadText
        .replace(/^(\d{1,3}[\.\-ºª]?\s+)/, '') // remove número sequencial
        .replace(/\b(8415\.\d{2}(?:\.\d{2})?|7411\.\d{2}(?:\.\d{2})?|\d{4}\.\d{2}\.\d{2})\b/g, '')
        .trim();

      let code = '';
      const codeMatch = cleanDesc.match(/^([A-Za-z0-9_.\-]{3,15})\s+(.+)$/);
      if (codeMatch && !/^(dumper|damper|grelha|difusor|tubo|bomba|suporte|fita|parafuso|curva|valvula|v[aá]lvula|registro|cabo|fio)/i.test(codeMatch[1])) {
        code = codeMatch[1];
        cleanDesc = codeMatch[2].trim();
      }

      if (i > 0 && cleanDesc.length < 20) {
        const prevL = lines[i - 1];
        if (!this.isIgnoredLine(prevL) && !/[\d]{1,3}[,.]\d{2}/.test(prevL) && prevL.length > 5) {
          cleanDesc = `${prevL} ${cleanDesc}`.trim();
        }
      }

      if (cleanDesc.length >= 2 && (unitPrice > 0 || totalPrice > 0)) {
        items.push({
          seq: items.length + 1,
          code: code || `REF-${items.length + 1}`,
          name: cleanDesc,
          description: cleanDesc,
          quantity: quantity || 1,
          unit,
          unitPrice: Number(unitPrice.toFixed(2)),
          unit_price: Number(unitPrice.toFixed(2)),
          totalPrice: Number(totalPrice.toFixed(2)),
          total_price: Number(totalPrice.toFixed(2)),
          subtotal: Number(totalPrice.toFixed(2))
        });
      }
    }

    return items;
  }

  static extractMultiLineBlocks(lines) {
    const items = [];
    const unitRegex = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${this.UNITS.join('|')})$`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^(?:Item\s*)?\d{1,3}$/i.test(line) && i + 2 < lines.length) {
        let desc = '';
        let code = '';
        let quantity = 0;
        let unit = 'UN';
        let unitPrice = 0;
        let totalPrice = 0;

        let j = i + 1;
        while (j < lines.length && j < i + 8) {
          const l = lines[j];
          if (j > i + 1 && /^(?:Item\s*)?\d{1,3}$/i.test(l)) break;
          if (this.isIgnoredLine(l)) break;

          const cMatch = l.match(/\b(?:código|codigo|ref)\b\s*[:]?\s*([A-Za-z0-9_-]+)/i);
          if (cMatch) {
            code = cMatch[1];
          } else if (unitRegex.test(l)) {
            const uM = l.match(unitRegex);
            quantity = this.parseBrNumber(uM[1]);
            unit = uM[2].toUpperCase();
          } else if (/(?:R\$\s*)?[\d]{1,3}(?:\.\d{3})*,\d{2}/.test(l)) {
            const val = this.parseBrNumber(l);
            if (unitPrice === 0) {
              unitPrice = val;
            } else if (totalPrice === 0) {
              totalPrice = val;
            }
          } else if (!desc && l.length > 4 && !/^\d+$/.test(l)) {
            desc = l;
          }
          j++;
        }

        if (desc && (unitPrice > 0 || totalPrice > 0)) {
          if (quantity === 0 && unitPrice > 0 && totalPrice > 0) {
            quantity = Math.round(totalPrice / unitPrice);
          }
          if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
            totalPrice = Number((unitPrice * quantity).toFixed(2));
          }

          items.push({
            seq: items.length + 1,
            code: code || `REF-${items.length + 1}`,
            name: desc,
            description: desc,
            quantity: quantity || 1,
            unit,
            unitPrice: Number(unitPrice.toFixed(2)),
            unit_price: Number(unitPrice.toFixed(2)),
            totalPrice: Number(totalPrice.toFixed(2)),
            total_price: Number(totalPrice.toFixed(2)),
            subtotal: Number(totalPrice.toFixed(2))
          });

          i = j - 1;
        }
      }
    }

    return items;
  }

  static extractGluedItems(lines) {
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const glued = this.parseGluedNumbers(line);
      if (glued) {
        let descLine = '';
        let j = i + 1;
        while (j < lines.length) {
          const nextL = lines[j];
          if (this.parseGluedNumbers(nextL) || this.isIgnoredLine(nextL)) {
            break;
          }
          if (!/^\d+$/.test(nextL)) {
            descLine = descLine ? `${descLine} ${nextL}` : nextL;
          }
          j++;
        }

        items.push({
          seq: items.length + 1,
          code: `REF-${items.length + 1}`,
          name: descLine || 'Material',
          description: descLine || 'Material',
          quantity: glued.quantity,
          unit: 'UN',
          unitPrice: glued.unitPrice,
          unit_price: glued.unitPrice,
          totalPrice: glued.totalPrice,
          total_price: glued.totalPrice,
          subtotal: glued.totalPrice
        });
        i = j - 1;
      }
    }
    return items;
  }

  static parseGluedNumbers(str) {
    const commaMatches = [...str.matchAll(/,/g)];
    if (commaMatches.length !== 2) return null;
    const c1 = commaMatches[0].index;
    const c2 = commaMatches[1].index;
    const partAfterC2 = str.slice(c2 + 1, c2 + 3);
    if (!/^\d{2}$/.test(partAfterC2)) return null;

    const totalIntStr = str.slice(c1 + 3, c2);
    const totalDecStr = partAfterC2;
    const totalVal = parseFloat(`${totalIntStr}.${totalDecStr}`);
    const unitDecStr = str.slice(c1 + 1, c1 + 3);
    const prefix = str.slice(0, c1);

    for (let splitIdx = 1; splitIdx < prefix.length; splitIdx++) {
      const qtyStr = prefix.slice(0, splitIdx);
      const unitIntStr = prefix.slice(splitIdx);
      const qty = parseFloat(qtyStr);
      const unitPrice = parseFloat(`${unitIntStr}.${unitDecStr}`);
      if (qty > 0 && unitPrice > 0 && Math.abs(qty * unitPrice - totalVal) < 0.05) {
        return { quantity: qty, unitPrice, totalPrice: totalVal };
      }
    }
    return null;
  }
}
