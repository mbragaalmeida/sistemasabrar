/**
 * PARSER DE NOTA FISCAL ELETRÔNICA (NF-e SEFAZ) — SISTEMA SABRAR
 *
 * Extrai dados estruturados de emitente (fornecedor), dados da nota fiscal
 * e todos os itens de materiais e produtos contidos nas tags <det> / <prod>.
 */

export function parseNfeXml(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Conteúdo do arquivo XML inválido ou vazio.');
  }

  // Helper para extrair valor de uma tag simples
  const extractTag = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  };

  // Helper para extrair bloco de tag
  const extractBlock = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : '';
  };

  // 1. Dados Gerais da NF-e
  const ideBlock = extractBlock(xmlContent, 'ide');
  const nNF = extractTag(ideBlock, 'nNF') || extractTag(xmlContent, 'nNF') || 'S/N';
  const serie = extractTag(ideBlock, 'serie') || extractTag(xmlContent, 'serie') || '1';
  const dhEmiRaw = extractTag(ideBlock, 'dhEmi') || extractTag(ideBlock, 'dEmi') || new Date().toISOString();
  const dhEmi = dhEmiRaw.split('T')[0];

  // Chave da NF-e
  let chNFe = extractTag(xmlContent, 'chNFe');
  if (!chNFe) {
    const idMatch = xmlContent.match(/Id="NFe(\d{44})"/i);
    chNFe = idMatch ? idMatch[1] : '';
  }

  // 2. Dados do Emitente (Fornecedor)
  const emitBlock = extractBlock(xmlContent, 'emit');
  const enderEmitBlock = extractBlock(emitBlock, 'enderEmit');

  const supplier = {
    cnpj: extractTag(emitBlock, 'CNPJ') || extractTag(emitBlock, 'CPF') || '',
    name: extractTag(emitBlock, 'xFant') || extractTag(emitBlock, 'xNome') || 'Fornecedor Identificado na NF',
    corporate_name: extractTag(emitBlock, 'xNome') || 'Fornecedor NF',
    contact_person: extractTag(emitBlock, 'xContato') || extractTag(emitBlock, 'xNome') || '',
    phone: extractTag(enderEmitBlock, 'fone') || '',
    email: extractTag(emitBlock, 'email') || '',
    city: extractTag(enderEmitBlock, 'xMun') || '',
    state: extractTag(enderEmitBlock, 'UF') || ''
  };

  // Formata CNPJ se tiver 14 dígitos
  if (supplier.cnpj && supplier.cnpj.length === 14) {
    supplier.cnpj = supplier.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  // 3. Totais da Nota
  const totalBlock = extractBlock(xmlContent, 'total');
  const icmsTotBlock = extractBlock(totalBlock, 'ICMSTot');
  const totalInvoice = Number(extractTag(icmsTotBlock, 'vNF') || 0);

  // 4. Produtos e Itens (<det nItem="...">)
  const items = [];
  const detRegex = /<det\s+nItem="(\d+)"[^>]*>([\s\S]*?)<\/det>/gi;
  let match;

  while ((match = detRegex.exec(xmlContent)) !== null) {
    const itemNumber = parseInt(match[1], 10);
    const detContent = match[2];
    const prodBlock = extractBlock(detContent, 'prod');

    if (prodBlock) {
      const code = extractTag(prodBlock, 'cProd') || `PROD-${itemNumber}`;
      const name = extractTag(prodBlock, 'xProd') || 'Produto sem descrição';
      const ncm = extractTag(prodBlock, 'NCM') || '';
      const cfop = extractTag(prodBlock, 'CFOP') || '';
      const unit = (extractTag(prodBlock, 'uCom') || 'UN').toUpperCase();
      const quantity = parseFloat(extractTag(prodBlock, 'qCom') || '1') || 1;
      const unitPrice = parseFloat(extractTag(prodBlock, 'vUnCom') || '0') || 0;
      const totalPrice = parseFloat(extractTag(prodBlock, 'vProd') || '0') || (quantity * unitPrice);

      items.push({
        itemNumber,
        code,
        name,
        ncm,
        cfop,
        unit,
        quantity: Number(quantity.toFixed(4)),
        unitPrice: Number(unitPrice.toFixed(4)),
        totalPrice: Number(totalPrice.toFixed(2))
      });
    }
  }

  // Fallback caso as tags det não tenham o atributo nItem
  if (items.length === 0) {
    const prodRegex = /<prod>([\s\S]*?)<\/prod>/gi;
    let idx = 1;
    while ((match = prodRegex.exec(xmlContent)) !== null) {
      const prodBlock = match[1];
      const code = extractTag(prodBlock, 'cProd') || `PROD-${idx}`;
      const name = extractTag(prodBlock, 'xProd') || 'Produto sem descrição';
      const unit = (extractTag(prodBlock, 'uCom') || 'UN').toUpperCase();
      const quantity = parseFloat(extractTag(prodBlock, 'qCom') || '1') || 1;
      const unitPrice = parseFloat(extractTag(prodBlock, 'vUnCom') || '0') || 0;
      const totalPrice = parseFloat(extractTag(prodBlock, 'vProd') || '0') || (quantity * unitPrice);

      items.push({
        itemNumber: idx++,
        code,
        name,
        unit,
        quantity: Number(quantity.toFixed(4)),
        unitPrice: Number(unitPrice.toFixed(4)),
        totalPrice: Number(totalPrice.toFixed(2))
      });
    }
  }

  return {
    invoiceNumber: nNF,
    serie,
    key: chNFe,
    emissionDate: dhEmi,
    totalValue: totalInvoice,
    supplier,
    items
  };
}
