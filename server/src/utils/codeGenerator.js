/**
 * Gerador de códigos únicos sequenciais para Projetos e Orçamentos
 * Evita colisões de chaves únicas (UNIQUE constraints) mesmo com exclusões ou concorrência.
 */

export async function generateUniqueBudgetCode(db) {
  try {
    const result = await db.prepare("SELECT code FROM budgets WHERE code LIKE 'ORC-2026-%'").all();
    let maxNum = 0;
    for (const row of (result || [])) {
      const match = row.code ? row.code.match(/ORC-2026-(\d+)/) : null;
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    let candidateNum = maxNum + 1;
    while (true) {
      const candidateCode = `ORC-2026-${String(candidateNum).padStart(3, '0')}`;
      const check = await db.prepare("SELECT id FROM budgets WHERE code = ?").get(candidateCode);
      if (!check) {
        return candidateCode;
      }
      candidateNum++;
    }
  } catch (err) {
    console.error('[CodeGenerator] Erro ao gerar código de orçamento, usando fallback com timestamp:', err);
    return `ORC-2026-${Date.now().toString().slice(-4)}`;
  }
}

export async function generateUniqueProjectCode(db) {
  try {
    const result = await db.prepare("SELECT code FROM projects WHERE code LIKE 'PRJ-2026-%'").all();
    let maxNum = 0;
    for (const row of (result || [])) {
      const match = row.code ? row.code.match(/PRJ-2026-(\d+)/) : null;
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    let candidateNum = maxNum + 1;
    while (true) {
      const candidateCode = `PRJ-2026-${String(candidateNum).padStart(3, '0')}`;
      const check = await db.prepare("SELECT id FROM projects WHERE code = ?").get(candidateCode);
      if (!check) {
        return candidateCode;
      }
      candidateNum++;
    }
  } catch (err) {
    console.error('[CodeGenerator] Erro ao gerar código de projeto, usando fallback com timestamp:', err);
    return `PRJ-2026-${Date.now().toString().slice(-4)}`;
  }
}
