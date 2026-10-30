import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  X,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  DollarSign,
  Building,
  Truck,
  Sparkles,
  Download
} from 'lucide-react';
import { api } from '../../services/api';

interface GenerateOCFromPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ItemRow {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export const GenerateOCFromPdfModal: React.FC<GenerateOCFromPdfModalProps> = ({
  isOpen,
  onClose
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Supplier & Order fields
  const [supplierName, setSupplierName] = useState('');
  const [supplierCnpj, setSupplierCnpj] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('28 DDL Boleto');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [freight, setFreight] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [proposalNumber, setProposalNumber] = useState('');

  // Project fields
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [projectCity, setProjectCity] = useState('');

  // Items table
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.getProjects().then((projs) => {
        setProjects(projs || []);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    const p = projects.find((x) => String(x.id) === projId);
    if (p) {
      setProjectName(`${p.code ? p.code + ' - ' : ''}${p.name}`);
      setProjectAddress(p.address || '');
      setProjectCity(p.city || '');
    } else {
      setProjectName('');
      setProjectAddress('');
      setProjectCity('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError('');
    setSuccess(false);

    try {
      const data = await api.parseSupplierPdf(file);
      
      if (data.supplier) {
        if (data.supplier.name) setSupplierName(data.supplier.name);
        if (data.supplier.cnpj) setSupplierCnpj(data.supplier.cnpj);
        if (data.supplier.phone) setSupplierPhone(data.supplier.phone);
        if (data.supplier.email) setSupplierEmail(data.supplier.email);
        if (data.supplier.payment_terms) setPaymentTerms(data.supplier.payment_terms);
        if (data.supplier.proposal_number) setProposalNumber(data.supplier.proposal_number);
        if (data.supplier.delivery_deadline) setDeliveryDate(data.supplier.delivery_deadline);
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((it: any) => {
            const uPrice = Number(it.unitPrice ?? it.unit_price ?? 0);
            const total = Number(it.totalPrice ?? it.total_price ?? it.subtotal ?? ((it.quantity || 1) * uPrice));
            return {
              code: it.code || '',
              name: it.name || it.description || '',
              quantity: Number(it.quantity) || 1,
              unit: it.unit || 'und',
              unitPrice: uPrice,
              subtotal: total
            };
          })
        );
      } else {
        setError('O PDF foi lido, mas nenhum item estruturado foi encontrado automaticamente. Você pode inserir os itens manualmente abaixo.');
      }
    } catch (err: any) {
      console.error('Erro ao ler PDF:', err);
      setError(err.message || 'Erro ao processar o arquivo PDF do fornecedor.');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleItemChange = (idx: number, field: keyof ItemRow, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(val) || 0 : item.quantity;
        const price = field === 'unitPrice' ? Number(val) || 0 : item.unitPrice;
        item.subtotal = qty * price;
      }
      next[idx] = item;
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { code: '', name: '', quantity: 1, unit: 'und', unitPrice: 0, subtotal: 0 }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotalItems = items.reduce((sum, it) => sum + (it.subtotal || 0), 0);
  const totalFinal = subtotalItems + Number(freight || 0) - Number(discount || 0);

  const handleExportOC = async () => {
    if (!supplierName.trim()) {
      setError('Por favor, informe o nome do fornecedor.');
      return;
    }
    if (items.length === 0) {
      setError('Adicione ou importe ao menos um item para gerar a Ordem de Compra.');
      return;
    }

    setExporting(true);
    setError('');

    try {
      await api.exportCustomOC({
        supplierName: supplierName.trim(),
        supplierCnpj: supplierCnpj.trim(),
        supplierPhone: supplierPhone.trim(),
        supplierEmail: supplierEmail.trim(),
        paymentTerms: paymentTerms.trim(),
        deliveryDate: deliveryDate.trim(),
        freight: Number(freight) || 0,
        discount: Number(discount) || 0,
        proposalNumber: proposalNumber.trim(),
        projectName: projectName.trim() || 'Obra Sabrar',
        projectAddress: projectAddress.trim(),
        projectCity: projectCity.trim(),
        items: items.map((it) => ({
          code: it.code,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice
        }))
      });
      setSuccess(true);
    } catch (err: any) {
      console.error('Erro ao exportar OC:', err);
      setError(err.message || 'Erro ao exportar a Ordem de Compra em Excel.');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  Gerar Ordem de Compra via PDF do Fornecedor
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                  Modelo Sabrar (.xlsx)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Faça upload do orçamento/proposta em PDF para identificar itens e exportar a planilha oficial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Upload Area */}
          <div className="p-4 rounded-2xl bg-dark-850 border-2 border-dashed border-dark-700 hover:border-emerald-500/60 transition-all flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  {parsing ? 'Processando Orçamento do Fornecedor...' : 'Upload do Orçamento do Fornecedor (PDF)'}
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Compatível com cotações de qualquer distribuidor (Protshop, Dufrio, ClimaTech, etc.)
                </p>
              </div>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md shadow-emerald-600/30 active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{parsing ? 'Extraindo Dados...' : 'Selecionar Arquivo PDF'}</span>
              </button>
            </div>
          </div>

          {/* Dados do Fornecedor & Pedido */}
          <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 space-y-3">
            <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-400 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Dados do Fornecedor Identificados
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-300 font-semibold">Nome do Fornecedor *</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ex: PROTSHOP EQUIPAMENTOS LTDA"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">CNPJ</label>
                <input
                  type="text"
                  value={supplierCnpj}
                  onChange={(e) => setSupplierCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Condição de Pagamento</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Ex: FATURADO 28DD"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Prazo de Entrega</label>
                <input
                  type="text"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  placeholder="Ex: 5 dias úteis"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Destino / Obra Sabrar */}
          <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 space-y-3">
            <span className="font-bold uppercase tracking-wider text-[10px] text-blue-400 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              Obra de Destino da Ordem de Compra
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Vincular a uma Obra Ativa</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Selecione a Obra (Opcional) --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.code ? `${p.code} - ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Nome da Obra / Local</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: Manutenção KIK West Shopping"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Itens Identificados e Editáveis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                Itens da Ordem de Compra ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 flex items-center gap-1 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-dark-850 border border-dark-750 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Código"
                      value={it.code}
                      onChange={(e) => handleItemChange(idx, 'code', e.target.value)}
                      className="w-full px-2 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Descrição do material..."
                      value={it.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Qtd"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-white text-center text-xs focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="text"
                      placeholder="Un"
                      value={it.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      className="w-full px-1.5 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-white text-center uppercase text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Preço Unit"
                      value={it.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                      className="w-full px-2 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-white text-right text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="p-8 text-center border border-dashed border-dark-700 rounded-2xl text-slate-400">
                  Nenhum item carregado. Faça o upload do PDF acima ou clique em "+ Adicionar Item".
                </div>
              )}
            </div>
          </div>

          {/* Totais & Frete */}
          <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-0.5">Valor do Frete (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freight}
                  onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 bg-dark-800 border border-dark-700 rounded-lg text-white text-right"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-0.5">Desconto (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 bg-dark-800 border border-dark-700 rounded-lg text-white text-right"
                />
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total da Ordem de Compra:</span>
              <span className="text-xl font-black text-emerald-400">{formatCurrency(totalFinal)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Ordem de Compra gerada e baixada com sucesso no modelo oficial da Sabrar!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800 bg-dark-850 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-dark-700 text-slate-300 hover:text-white font-semibold text-xs"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleExportOC}
            disabled={exporting || items.length === 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Gerando Planilha OC...' : 'Baixar Ordem de Compra (.xlsx Modelo Sabrar)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
