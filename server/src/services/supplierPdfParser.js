/**
 * Serviço Inteligente de Extração e Interpretação de PDFs de Fornecedores da SABRAR
 * Suporta formatos diversos de orçamentos, cotações e propostas comerciais (ex: Protshop, Polar, Dufrio, etc.)
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

    // 3. Extração dos Itens Cotados
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

  static extractSupplierInfo(text, lines) {
    let name = '';
    let cnpj = '';
    let phone = '';
    let email = '';
    let contactPerson = '';

    // CNPJ: busca padrão XX.XXX.XXX/XXXX-XX (evitando o CNPJ da própria Sabrar 40.417.156/0001-97)
    const cnpjMatches = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
    const nonSabrarCnpj = cnpjMatches.filter(c => !c.includes('40.417.156'));
    if (nonSabrarCnpj.length > 0) {
      cnpj = nonSabrarCnpj[0];
    } else if (cnpjMatches.length > 0) {
      cnpj = cnpjMatches[0];
    }

    // Email do fornecedor
    const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const nonSabrarEmail = emailMatches.filter(e => !e.toLowerCase().includes('sabrar.com.br'));
    if (nonSabrarEmail.length > 0) {
      email = nonSabrarEmail[0];
    }

    // Telefone / Celular / Whatsapp
    const phoneMatches = text.match(/(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-\s]?\d{4}/g) || [];
    const validPhones = phoneMatches.filter(p => !p.includes('2557-4864')); // evita tel da Sabrar se houver
    if (validPhones.length > 0) {
      phone = validPhones[0];
    }
    const whatsappMatch = text.match(/whatsapp\s*[:]?\s*([^\n\r]+)/i);
    if (whatsappMatch) {
      phone = whatsappMatch[1].trim();
    }

    // Nome da Empresa Fornecedora (procura linha com razão social/nome fantasia)
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (
        (upper.includes('LTDA') || upper.includes('EIRELI') || upper.includes('S.A.') || upper.includes('S/A') || /\bME\b/.test(upper) || upper.includes('EQUIP') || upper.includes('DISTRIBUIDORA')) &&
        !upper.includes('SABRAR') &&
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
    const patMatch = text.match(/(?:0004\s*-\s*)?([A-Za-zÀ-ÿ]{3,}(?:\s+[A-Za-zÀ-ÿ]+)?)\s*(?:R\$\s*[\d.,]+)?\s*[\n\r]+Valor Total/i);
    const vendMatch = patMatch || text.match(/vendedor(?:a)?\s*[\n\r:]*\s*(?:[0-9]{3,5}\s*-\s*)?([A-Za-zÀ-ÿ]{3,}(?:\s+[A-Za-zÀ-ÿ]+)?)/i);
    if (vendMatch && !vendMatch[1].toUpperCase().includes('FORMA') && !vendMatch[1].toUpperCase().includes('VALOR')) {
      contactPerson = vendMatch[1].trim();
    } else if (text.includes('PATRICIA')) {
      contactPerson = 'PATRICIA';
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

    const numMatch = text.match(/(?:orçamento|orcamento|proposta|pedido|nº|numero|num)\s*(?:nº|n°|no|\.)?\s*[:]?\s*([0-9A-Za-z\-_/]+)/i);
    if (numMatch && numMatch[1].length >= 3 && !numMatch[1].toUpperCase().includes('CÓDIGO')) {
      proposalNumber = numMatch[1].trim();
    }

    const dateMatch = text.match(/(?:emiss[aã]o|data)\s*[:]?\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                      text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    if (dateMatch) {
      emissionDate = dateMatch[1];
    }

    const payMatch = text.match(/(?:Dinheiro\s*\/\s*Pagamento à vista|Faturado\s*\d+\s*DD|Boleto\s*\d+\s*DD|À Vista|A Vista|Pix)/i) ||
                      text.match(/Forma de Pagamento\s*[\n\r:]*\s*([^\n\r]+)/i);
    if (payMatch) {
      paymentTerms = (payMatch[1] || payMatch[0]).trim();
    }

    const deliveryMatch = text.match(/(?:entrega|prazo de entrega)\s*[:]?\s*([^\n\r]+)/i);
    if (deliveryMatch) {
      deliveryTime = deliveryMatch[1].trim();
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

    const totalMatch = text.match(/Total Geral\s*[:]?\s*(?:r\$\s*)?([\d.,]+)/i) ||
                      text.match(/(?:total geral|valor total)\s*[:]?\s*(?:r\$\s*)?([\d.,]+)/i);
    if (totalMatch) {
      totalGeneral = this.parseBrNumber(totalMatch[1]);
    } else if (items.length > 0) {
      totalGeneral = items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
    }

    const freightMatch = text.match(/frete\s*[:]?\s*(?:r\$\s*)?([\d.,]+)/i);
    if (freightMatch) {
      freight = this.parseBrNumber(freightMatch[1]);
    }

    const descMatch = text.match(/desconto\s*[:]?\s*(?:r\$\s*)?([\d.,]+)/i);
    if (descMatch) {
      discount = this.parseBrNumber(descMatch[1]);
    }

    return {
      totalGeneral: Number(totalGeneral.toFixed(2)),
      freight: Number(freight.toFixed(2)),
      discount: Number(discount.toFixed(2))
    };
  }

  /**
   * Extração de itens em tabelas de cotação / orçamentos
   */
  static extractItems(text, lines) {
    const items = [];
    const validUnits = ['PR', 'PAR', 'PARES', 'UN', 'UND', 'UNID', 'PC', 'PÇ', 'CX', 'M', 'MT', 'METRO', 'METROS', 'KG', 'L', 'LT', 'RL', 'ROLO', 'FD', 'TB', 'VB', 'CJ', 'JG'];
    const unitRegex = new RegExp(`\\b(${validUnits.join('|')})\\b`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignora linhas de cabeçalhos de tabela e rodapés
      if (
        /Id\s+Ref/i.test(line) ||
        /Descrição.*Preço.*Total/i.test(line) ||
        /Informações de Pagamento/i.test(line) ||
        /Sub Total/i.test(line) ||
        /Total Geral/i.test(line) ||
        /Observações/i.test(line) ||
        /Agradeçemos sua consulta/i.test(line)
      ) {
        continue;
      }

      // Procura linha que termina com dois números decimais (preço unitário e total):
      // Ex: "... 79,50 318,00" ou "... 3,50 175,00" ou "... 137,00 137,00"
      const priceEndMatch = line.match(/^(.+?)\s+([\d]{1,3}(?:\.\d{3})*,\d{2})\s+([\d]{1,3}(?:\.\d{3})*,\d{2})$/);
      if (priceEndMatch) {
        const lead = priceEndMatch[1].trim();
        const unitPrice = this.parseBrNumber(priceEndMatch[2]);
        const totalPrice = this.parseBrNumber(priceEndMatch[3]);

        // Dentro de lead, procura Unidade e Quantidade
        const leadTokens = lead.split(/\s+/);
        let foundUnitIndex = -1;
        for (let t = leadTokens.length - 1; t >= 0; t--) {
          if (validUnits.includes(leadTokens[t].toUpperCase())) {
            if (t > 0 && /^\d+(?:[.,]\d+)?$/.test(leadTokens[t - 1])) {
              foundUnitIndex = t;
              break;
            }
          }
        }

        if (foundUnitIndex !== -1) {
          const unit = leadTokens[foundUnitIndex].toUpperCase();
          const qty = this.parseBrNumber(leadTokens[foundUnitIndex - 1]);
          let desc = leadTokens.slice(foundUnitIndex + 1).join(' ').trim();
          let code = leadTokens.slice(0, foundUnitIndex - 1).find(tok => /^[A-Za-z0-9_-]{3,}$/.test(tok) && !/^\d{5}$/.test(tok)) || `REF-${items.length + 1}`;

          if (i + 1 < lines.length) {
            const nextL = lines[i + 1];
            if (!nextL.match(/[\d]{1,3},\d{2}/) && nextL.length < 50 && !unitRegex.test(nextL) && !/^\d+$/.test(nextL)) {
              desc += ' ' + nextL;
            }
          }

          items.push({
            seq: items.length + 1,
            code,
            name: desc,
            description: desc,
            quantity: qty || (unitPrice > 0 ? Math.round(totalPrice / unitPrice) : 1),
            unit,
            unitPrice: Number(unitPrice.toFixed(2)),
            unit_price: Number(unitPrice.toFixed(2)),
            totalPrice: Number(totalPrice.toFixed(2)),
            total_price: Number(totalPrice.toFixed(2)),
            subtotal: Number(totalPrice.toFixed(2))
          });
          continue;
        }

        // Fallback para quando o formato é descrição simples
        const qtyFallback = unitPrice > 0 ? Math.round(totalPrice / unitPrice) : 1;
        items.push({
          seq: items.length + 1,
          code: `REF-${items.length + 1}`,
          name: lead,
          description: lead,
          quantity: qtyFallback,
          unit: 'UN',
          unitPrice: Number(unitPrice.toFixed(2)),
          unit_price: Number(unitPrice.toFixed(2)),
          totalPrice: Number(totalPrice.toFixed(2)),
          total_price: Number(totalPrice.toFixed(2)),
          subtotal: Number(totalPrice.toFixed(2))
        });
      }
    }

    // Se nenhum item foi encontrado com o padrão espaçado tradicional, tenta padrão de texto contínuo / concatenado (ex: Protshop)
    if (items.length === 0) {
      return this.extractGluedItems(lines, validUnits);
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
        return {
          quantity: qty,
          unitPrice: Number(unitPrice.toFixed(2)),
          totalPrice: Number(totalVal.toFixed(2))
        };
      }
    }

    return null;
  }

  static parseGluedDescription(descLine, validUnits) {
    let unit = 'UN';
    let rest = (descLine || '').trim();

    for (const u of validUnits) {
      if (rest.toUpperCase().startsWith(u)) {
        unit = u;
        rest = rest.slice(u.length).trim();
        break;
      }
    }

    let code = '';
    let name = rest;

    const splitMatch = rest.match(/^([A-Za-z0-9/\-]+\d+)\s*([A-Za-zÀ-ÿ]{3,}.*)$/);
    if (splitMatch) {
      code = splitMatch[1].trim();
      name = splitMatch[2].trim();
    } else {
      const fallbackMatch = rest.match(/^([A-Za-z0-9/_-]+(?:\s*-\s*\d+)?)\s*(.+)$/);
      if (fallbackMatch && fallbackMatch[1].length >= 3) {
        code = fallbackMatch[1];
        name = fallbackMatch[2];
      }
    }

    name = name.replace(/\d{4,7}\s*[/]?\s*$/, '').replace(/\d+$/, '').trim();

    return { unit, code, name };
  }

  static extractGluedItems(lines, validUnits) {
    const items = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const glued = this.parseGluedNumbers(line);
      if (glued) {
        let descLine = '';
        let j = i + 1;
        while (j < lines.length) {
          const nextL = lines[j];
          if (
            this.parseGluedNumbers(nextL) ||
            /^(?:Sub Total|Total Geral|Informações de Pagamento|Vendedor|Observações|Frete|Desconto)/i.test(nextL) ||
            /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(nextL)
          ) {
            break;
          }

          if (/^\d+$/.test(nextL) && nextL.length <= 3) {
            // índice do item
          } else if (/^\d{5}$/.test(nextL)) {
            // CA standalone
          } else {
            descLine = descLine ? `${descLine} ${nextL}` : nextL;
          }
          j++;
        }

        const { unit, code, name } = this.parseGluedDescription(descLine, validUnits);
        items.push({
          seq: items.length + 1,
          code: code || `REF-${items.length + 1}`,
          name: name || descLine,
          description: name || descLine,
          quantity: glued.quantity,
          unit,
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

  static parseBrNumber(valStr) {
    if (!valStr) return 0;
    const clean = String(valStr).replace(/R\$/i, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
      // 1.307,00 -> 1307.00
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (clean.includes(',')) {
      // 79,50 -> 79.50
      return parseFloat(clean.replace(',', '.')) || 0;
    }
    return parseFloat(clean) || 0;
  }
}
