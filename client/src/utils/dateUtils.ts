/**
 * Utilitários para datas no fuso horário do Brasil (America/Sao_Paulo / UTC-3)
 * Evita descompassos de UTC (ex: depois das 21h virar o dia seguinte)
 * e resolve erros de "Invalid Date" em strings ISO de bancos PostgreSQL/Supabase.
 */

export function getTodayBR(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysBR(days: number, fromDate?: string): string {
  let base: Date;
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    const [y, m, d] = fromDate.split('-').map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date();
  }
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata qualquer formato de data vindo do PostgreSQL/Supabase ou formulário
 * para o padrão brasileiro DD/MM/AAAA de forma 100% segura sem "Invalid Date".
 */
export function formatDateBR(dateVal?: string | Date | null): string {
  if (!dateVal) return 'Data a Combinar / Imediata';

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return 'Data a Combinar / Imediata';

    // Se já estiver no formato DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Se tiver padrão YYYY-MM-DD (seja "2026-10-17", "2026-10-17T03:00:00.000Z", ou timestamp)
    const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }

  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  } catch {
    // fallback
  }

  return 'Data a Combinar';
}

/**
 * Converte DD/MM/AAAA para YYYY-MM-DD para salvar no banco
 */
export function parseDateBRToISO(str?: string): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Máscara amigável para digitação de data no mobile (DD/MM/AAAA)
 */
export function maskDateInput(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatDateTimeBR(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString('pt-BR');
      const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} às ${timeStr}`;
    }
  } catch {
    // fallback
  }
  return formatDateBR(dateVal);
}
