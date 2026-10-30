import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Plus,
  CheckCircle,
  Trophy,
  DollarSign,
  Truck,
  Percent,
  Calendar,
  Building,
  Printer,
  Trash2,
  Edit2,
  Search,
  Package,
  ChevronDown,
  UploadCloud,
  Sparkles,
  Edit3
} from 'lucide-react';
import { api } from '../../services/api';

interface QuotationItem {
  id: number;
  material_id: number;
  mat_name?: string;
  mat_code?: string;
  item_description?: string;
  quantity: number;
  unit: string;
  reference_price?: number;
}

interface QuotationSupplier {
  id: number;
  supplier_id?: number;
  supplier_name: string;
  cnpj?: string;
  contact_name?: string;
  phone?: string;
  items_prices?: any; // Record<number, number>
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  freight_amount: number;
  total_amount: number;
  payment_terms?: string;
  delivery_deadline_days?: number;
  is_winner?: boolean;
}

interface QuotationComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: number | null;
  onSuccess?: () => void;
}

export const QuotationComparisonModal: React.FC<QuotationComparisonModalProps> = ({
  isOpen,
  onClose,
  quotationId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [activeQuotationId, setActiveQuotationId] = useState<number | null>(quotationId);
  const [quotation, setQuotation] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<QuotationSupplier[]>([]);
  const [items, setItems] = useState<QuotationItem[]>([]);

  // Lista de fornecedores cadastrados na base (para autocompletar proposta opcionalmente)
  const [registeredSuppliers, setRegisteredSuppliers] = useState<any[]>([]);
  const [selectedRegisteredId, setSelectedRegisteredId] = useState<string>('');

  // Estado para adicionar novo fornecedor à cotação
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newCnpj, setNewCnpj] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrices, setNewPrices] = useState<Record<number, number>>({});
  const [newTaxRate, setNewTaxRate] = useState<number>(0);
  const [newFreight, setNewFreight] = useState<number>(0);
  const [newDeliveryDays, setNewDeliveryDays] = useState<number>(5);
  const [newPaymentTerms, setNewPaymentTerms] = useState('28 DDL Boleto');
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Estado para adicionar / gerenciar itens no comparativo de preços
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemMaterialId, setNewItemMaterialId] = useState<number | null>(null);
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemUnit, setNewItemUnit] = useState<string>('und');
  const [materialSuggestions, setMaterialSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);

  // Estado para Edição Completa de Item (Item 15)
  const [editingItem, setEditingItem] = useState<QuotationItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQty, setEditItemQty] = useState<number>(1);
  const [editItemUnit, setEditItemUnit] = useState('und');
  const [savingEditItem, setSavingEditItem] = useState(false);
  const [editMaterialSuggestions, setEditMaterialSuggestions] = useState<any[]>([]);
  const [loadingEditSuggestions, setLoadingEditSuggestions] = useState(false);

  // Estado para Upload do PDF do Fornecedor (Item 15)
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadRegisteredSuppliers();
      if (quotationId) {
        setActiveQuotationId(quotationId);
        loadQuotationDetails(quotationId);
      } else {
        api.getQuotations().then(list => {
          if (list && list.length > 0) {
            setActiveQuotationId(list[0].id);
            loadQuotationDetails(list[0].id);
          }
        }).catch(console.error);
      }
    }
  }, [isOpen, quotationId]);

  const loadRegisteredSuppliers = async () => {
    try {
      const sups = await api.getSuppliers();
      setRegisteredSuppliers(sups || []);
    } catch (err) {
      console.error('Erro ao carregar fornecedores cadastrados:', err);
    }
  };

  const handleSelectRegisteredSupplier = (supIdStr: string) => {
    setSelectedRegisteredId(supIdStr);
    if (!supIdStr) return;
    const sup = registeredSuppliers.find(s => String(s.id) === supIdStr);
    if (sup) {
      setNewSupplierName(sup.name || '');
      setNewCnpj(sup.cnpj || '');
      setNewContact(sup.contact_person || '');
      setNewPhone(sup.phone || '');
    }
  };

  const handleMaterialSearch = async (val: string) => {
    setNewItemName(val);
    setNewItemMaterialId(null);
    if (!val.trim() || val.length < 2) {
      setMaterialSuggestions([]);
      return;
    }
    try {
      setLoadingSuggestions(true);
      const res = await api.autocompleteMaterials(val.trim());
      setMaterialSuggestions(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSelectMaterialSuggestion = (mat: any) => {
    setNewItemName(mat.name);
    setNewItemMaterialId(mat.id);
    if (mat.unit) setNewItemUnit(mat.unit);
    setMaterialSuggestions([]);
  };

  const handleAddItemToQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      alert('Informe o nome ou selecione o material a comparar.');
      return;
    }
    const qId = activeQuotationId || quotationId || (quotation && quotation.id);
    if (!qId) {
      alert('Cotação não identificada.');
      return;
    }

    try {
      setSubmittingItem(true);
      await api.addQuotationItem(qId, {
        material_id: newItemMaterialId,
        material_description: newItemName.trim(),
        quantity: Number(newItemQuantity) || 1,
        unit: newItemUnit.trim() || 'und'
      });

      setNewItemName('');
      setNewItemMaterialId(null);
      setNewItemQuantity(1);
      setNewItemUnit('und');
      setShowAddItem(false);
      await loadQuotationDetails(qId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar item ao comparativo.');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleOpenEditItem = (it: QuotationItem) => {
    setEditingItem(it);
    setEditItemName(it.mat_name || it.item_description || '');
    setEditItemQty(it.quantity || 1);
    setEditItemUnit(it.unit || 'und');
    setEditMaterialSuggestions([]);
  };

  const handleEditMaterialSearch = async (val: string) => {
    setEditItemName(val);
    if (!val.trim() || val.length < 2) {
      setEditMaterialSuggestions([]);
      return;
    }
    try {
      setLoadingEditSuggestions(true);
      const res = await api.autocompleteMaterials(val.trim());
      setEditMaterialSuggestions(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEditSuggestions(false);
    }
  };

  const handleSelectEditMaterialSuggestion = (mat: any) => {
    setEditItemName(mat.name);
    if (mat.unit) setEditItemUnit(mat.unit);
    setEditMaterialSuggestions([]);
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const qId = activeQuotationId || quotationId || (quotation && quotation.id);
    if (!qId) return;

    try {
      setSavingEditItem(true);
      await api.updateQuotationItem(qId, editingItem.id, {
        material_description: editItemName.trim(),
        quantity: Number(editItemQty) || 1,
        unit: editItemUnit.trim() || 'und'
      });
      setEditingItem(null);
      await loadQuotationDetails(qId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar item.');
    } finally {
      setSavingEditItem(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: number, supName: string) => {
    if (!window.confirm(`Deseja remover a proposta de "${supName}" do mapa comparativo?`)) return;
    const qId = activeQuotationId || quotationId || (quotation && quotation.id);
    if (!qId) return;
    try {
      await api.deleteQuotationSupplier(qId, supplierId);
      await loadQuotationDetails(qId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover proposta de fornecedor');
    }
  };

  const handleUploadSupplierPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const qId = activeQuotationId || quotationId || (quotation && quotation.id);
    if (!qId) {
      alert('Selecione ou crie uma cotação antes de importar a proposta.');
      return;
    }

    setParsingPdf(true);
    setPdfSuccessMessage('');

    try {
      const data = await api.parseSupplierPdf(file);
      
      if (data.supplier) {
        if (data.supplier.name) setNewSupplierName(data.supplier.name);
        if (data.supplier.cnpj) setNewCnpj(data.supplier.cnpj);
        if (data.supplier.phone) setNewPhone(data.supplier.phone);
        if (data.supplier.vendor) setNewContact(data.supplier.vendor);
        if (data.supplier.payment_terms) setNewPaymentTerms(data.supplier.payment_terms);
        if (data.supplier.delivery_deadline) {
          const matchDays = data.supplier.delivery_deadline.match(/\d+/);
          if (matchDays) setNewDeliveryDays(Number(matchDays[0]));
        }
      }

      let currentItems = [...items];
      const newPricesMap: Record<number, number> = {};

      if (Array.isArray(data.items) && data.items.length > 0) {
        // Garante lista atualizada de itens da cotação
        const initialQuotation = await api.getQuotationById(qId);
        currentItems = initialQuotation.items || [];

        for (const pdfItem of data.items) {
          const pName = (pdfItem.name || pdfItem.description || '').toLowerCase().trim();
          const pCode = (pdfItem.code || '').toLowerCase().trim();
          const itemUnitPrice = Number(pdfItem.unitPrice ?? pdfItem.unit_price ?? 0);

          let matched = currentItems.find(it => {
            const itName = (it.mat_name || it.item_description || '').toLowerCase().trim();
            const itCode = (it.mat_code || '').toLowerCase().trim();
            return (pCode && itCode && pCode === itCode) || (pName && itName && (itName.includes(pName) || pName.includes(itName)));
          });

          if (!matched) {
            try {
              await api.addQuotationItem(qId, {
                material_description: pdfItem.name || pdfItem.description || 'Item importado do PDF',
                quantity: Number(pdfItem.quantity) || 1,
                unit: pdfItem.unit || 'und',
                unit_price: itemUnitPrice
              });
              const refreshed = await api.getQuotationById(qId);
              currentItems = refreshed.items || [];
              matched = currentItems.find(it => {
                const itName = (it.mat_name || it.item_description || '').toLowerCase().trim();
                const itCode = (it.mat_code || '').toLowerCase().trim();
                return (pCode && itCode && pCode === itCode) || (pName && itName && (itName.includes(pName) || pName.includes(itName)));
              });
            } catch (addErr) {
              console.warn('Erro ao auto-adicionar item do PDF na cotação:', addErr);
            }
          }

          if (matched) {
            newPricesMap[matched.id] = itemUnitPrice;
          }
        }

        setNewPrices(prev => ({ ...prev, ...newPricesMap }));
        await loadQuotationDetails(qId);
        setShowAddSupplier(true);
        setShowAddItem(false);
        setPdfSuccessMessage(`PDF de "${data.supplier?.name || 'Fornecedor'}" importado com sucesso! ${data.items.length} itens e preços carregados na proposta.`);
      } else {
        alert('O PDF foi processado mas não foram identificados itens tabulares. Verifique o arquivo.');
      }
    } catch (err: any) {
      console.error('Erro ao ler PDF do fornecedor:', err);
      alert(err.message || 'Erro ao processar o arquivo PDF do fornecedor.');
    } finally {
      setParsingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleDeleteItem = async (itemId: number, desc: string) => {
    if (!window.confirm(`Deseja remover o item "${desc}" deste mapa comparativo de preços?`)) {
      return;
    }
    const qId = activeQuotationId || quotationId || (quotation && quotation.id);
    if (!qId) return;

    try {
      await api.deleteQuotationItem(qId, itemId);
      await loadQuotationDetails(qId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover item.');
    }
  };

  const handleEditItemQuantity = async (it: QuotationItem) => {
    const raw = window.prompt(`Alterar quantidade para "${it.mat_name || it.item_description}":`, String(it.quantity));
    if (raw === null) return;
    const newQty = parseFloat(raw.replace(',', '.'));
    if (isNaN(newQty) || newQty <= 0) {
      alert('Quantidade inválida.');
      return;
    }
    const qId = activeQuotationId || quotationId || (quotation && quotation.id);
    if (!qId) return;

    try {
      await api.updateQuotationItem(qId, it.id, { quantity: newQty });
      await loadQuotationDetails(qId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar quantidade.');
    }
  };

  const loadQuotationDetails = async (idToLoad?: number) => {
    const qId = idToLoad || activeQuotationId || quotationId;
    if (!qId) return;
    try {
      setLoading(true);
      const res = await api.getQuotationById(qId);
      setQuotation(res.quotation);
      setSuppliers(res.suppliers || []);
      setItems(res.items || []);
    } catch (err: any) {
      console.error('Erro ao carregar cotação:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (itemId: number, val: string) => {
    const num = parseFloat(val) || 0;
    setNewPrices(prev => ({ ...prev, [itemId]: num }));
  };

  // Calcular subtotal do novo fornecedor dinamicamente
  const calcNewSubtotal = () => {
    return items.reduce((sum, it) => {
      const p = newPrices[it.id] || 0;
      return sum + p * it.quantity;
    }, 0);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      alert('Informe o nome do fornecedor.');
      return;
    }

    try {
      setSubmittingSupplier(true);
      const subtotal = calcNewSubtotal();
      const taxAmount = (subtotal * (Number(newTaxRate) || 0)) / 100;
      const totalAmount = subtotal + taxAmount + (Number(newFreight) || 0);

      await api.addQuotationSupplier(quotationId!, {
        supplier_name: newSupplierName,
        cnpj: newCnpj,
        contact_name: newContact,
        phone: newPhone,
        items_prices: newPrices,
        subtotal,
        tax_rate: Number(newTaxRate) || 0,
        tax_amount: taxAmount,
        freight_amount: Number(newFreight) || 0,
        total_amount: totalAmount,
        payment_terms: newPaymentTerms,
        delivery_deadline_days: Number(newDeliveryDays) || 0
      });

      setShowAddSupplier(false);
      setNewSupplierName('');
      setNewCnpj('');
      setNewContact('');
      setNewPhone('');
      setNewPrices({});
      await loadQuotationDetails();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar proposta do fornecedor.');
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const handleSetWinner = async (supplierId: number, name: string) => {
    if (!window.confirm(`Deseja aprovar e homologar a proposta de "${name}" como vencedora deste mapa comparativo?`)) {
      return;
    }
    try {
      await api.setQuotationWinner(quotationId!, supplierId);
      alert('Fornecedor vencedor definido e mapa homologado com sucesso!');
      await loadQuotationDetails();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao homologar fornecedor vencedor.');
    }
  };

  if (!isOpen) return null;

  // Encontrar o menor preço de cada item entre os fornecedores para destacar em verde
  const getLowestItemPrice = (itemId: number) => {
    let minPrice: number | null = null;
    suppliers.forEach(s => {
      const pMap = typeof s.items_prices === 'string' ? JSON.parse(s.items_prices) : s.items_prices || {};
      const price = Number(pMap[itemId]);
      if (price > 0) {
        if (minPrice === null || price < minPrice) {
          minPrice = price;
        }
      }
    });
    return minPrice;
  };

  // Encontrar o menor custo total final
  const lowestTotalAmount = suppliers.length > 0
    ? Math.min(...suppliers.map(s => Number(s.total_amount) || Infinity))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 my-auto">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Mapa Comparativo de Preços e Fornecedores
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  {quotation?.quotation_number || 'COT-2026'}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  quotation?.status === 'Aprovada'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  {quotation?.status || 'Em Cotação'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <Building className="w-3.5 h-3.5" />
                Obra: <span className="font-medium text-slate-700 dark:text-slate-300">{quotation?.project_name || 'Demanda Geral Sabrar'}</span>
                {quotation?.deadline && (
                  <>
                    <span>•</span>
                    <Calendar className="w-3.5 h-3.5" />
                    Prazo limite: {new Date(quotation.deadline).toLocaleDateString('pt-BR')}
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {activeQuotationId && (
              <a
                href={api.exportQuotationOCUrl(activeQuotationId)}
                download={`Ordem_de_Compra_Cotacao_${activeQuotationId}.xlsx`}
                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                title="Exportar Ordem de Compra em formato Excel editável (.xlsx modelo Sabrar)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar OC (Excel)</span>
              </a>
            )}
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              title="Imprimir Mapa Comparativo"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              Carregando cotações e propostas dos fornecedores...
            </div>
          ) : (
            <>
              {/* Barra de Ações: Adicionar Fornecedor e Gerenciar Itens */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 p-3 rounded-xl">
                <div className="text-sm">
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    {suppliers.length} Fornecedor(es) cotados • {items.length} Item(ns) no comparativo
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300 block sm:inline sm:ml-2">
                    (Compare lado a lado os preços unitários, impostos, frete e condições)
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleUploadSupplierPdf}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={parsingPdf}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Upload do PDF do fornecedor para imputar itens e preços automaticamente"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{parsingPdf ? 'Lendo PDF...' : 'Upload PDF Fornecedor'}</span>
                  </button>

                  {!showAddItem && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItem(true);
                        setShowAddSupplier(false);
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 !text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      + Adicionar Item ao Mapa
                    </button>
                  )}
                  {!showAddSupplier && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSupplier(true);
                        setShowAddItem(false);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 !text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Inserir Proposta de Fornecedor
                    </button>
                  )}
                </div>
              </div>

              {pdfSuccessMessage && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{pdfSuccessMessage}</span>
                  </div>
                  <button onClick={() => setPdfSuccessMessage('')} className="text-slate-400 hover:text-white text-xs">
                    ✕
                  </button>
                </div>
              )}

              {/* Formulário Colapsável de Adicionar Item ao Comparativo */}
              {showAddItem && (
                <form onSubmit={handleAddItemToQuotation} className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 p-4 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/80 pb-2">
                    <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-600" />
                      Adicionar Item / Material ao Mapa Comparativo
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddItem(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
                    <div className="md:col-span-2 relative">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Material (Buscar no catálogo ou digitar especificação) *
                      </label>
                      <input
                        type="text"
                        required
                        value={newItemName}
                        onChange={e => handleMaterialSearch(e.target.value)}
                        placeholder="Ex: Digite nome do material..."
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      {loadingSuggestions && (
                        <div className="absolute right-3 top-8 text-[11px] text-slate-400">Buscando...</div>
                      )}
                      {materialSuggestions.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {materialSuggestions.map(mat => (
                            <div
                              key={mat.id}
                              onClick={() => handleSelectMaterialSuggestion(mat)}
                              className="p-2.5 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer text-xs border-b border-slate-100 dark:border-slate-700 last:border-0"
                            >
                              <div className="font-bold text-slate-900 dark:text-white">{mat.name}</div>
                              <div className="text-[10px] text-slate-400">Cód: {mat.code} • Unid: {mat.unit} • Cat: {mat.category}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={newItemQuantity}
                        onChange={e => setNewItemQuantity(parseFloat(e.target.value) || 1)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Unidade *
                      </label>
                      <input
                        type="text"
                        required
                        value={newItemUnit}
                        onChange={e => setNewItemUnit(e.target.value)}
                        placeholder="und, m, kg..."
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddItem(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submittingItem}
                      className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 !text-white font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      {submittingItem ? 'Adicionando...' : 'Adicionar ao Mapa'}
                    </button>
                  </div>
                </form>
              )}

              {/* Formulário Colapsável de Novo Fornecedor */}
              {showAddSupplier && (
                <form onSubmit={handleAddSupplier} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-600" />
                      Cadastrar Proposta de Fornecedor para o Mapa
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddSupplier(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>

                  {/* Seleção rápida de fornecedor cadastrado (Opcional - não obrigatório) */}
                  {registeredSuppliers.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40">
                      <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        Autopreencher com Fornecedor Cadastrado (Opcional):
                      </label>
                      <select
                        value={selectedRegisteredId}
                        onChange={e => handleSelectRegisteredSupplier(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      >
                        <option value="">-- Digitar livremente abaixo (Não é obrigatório estar cadastrado) --</option>
                        {registeredSuppliers.map(s => (
                          <option key={s.id} value={String(s.id)}>
                            {s.name} {s.cnpj ? `(CNPJ: ${s.cnpj})` : ''} {s.contact_person ? `- Contato: ${s.contact_person}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Dica: O cadastro prévio do fornecedor <strong>não é obrigatório</strong>. Você pode digitar qualquer nome livremente abaixo.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nome do Fornecedor *
                      </label>
                      <input
                        type="text"
                        required
                        value={newSupplierName}
                        onChange={e => setNewSupplierName(e.target.value)}
                        placeholder="Ex: Dufrio Refrigeração"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        value={newCnpj}
                        onChange={e => setNewCnpj(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Contato / Vendedor
                      </label>
                      <input
                        type="text"
                        value={newContact}
                        onChange={e => setNewContact(e.target.value)}
                        placeholder="Nome do contato"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* Preços por item */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Preços Unitários por Item (R$)
                    </div>
                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                      {items.map(it => (
                        <div key={it.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <span className="font-medium text-slate-800 dark:text-slate-200 max-w-md truncate">
                            {it.mat_name || it.item_description} ({it.quantity} {it.unit})
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">R$ Unit:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={newPrices[it.id] || ''}
                              onChange={e => handlePriceChange(it.id, e.target.value)}
                              className="w-24 text-right px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                            />
                            <span className="text-slate-400 w-24 text-right font-medium text-blue-600 dark:text-blue-400">
                              Total: R$ {((newPrices[it.id] || 0) * it.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impostos, Frete e Condições */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Alíquota Imposto (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={newTaxRate}
                        onChange={e => setNewTaxRate(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 12"
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Frete (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newFreight}
                        onChange={e => setNewFreight(parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Prazo de Entrega (dias)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newDeliveryDays}
                        onChange={e => setNewDeliveryDays(parseInt(e.target.value) || 0)}
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Condição de Pagamento
                      </label>
                      <input
                        type="text"
                        value={newPaymentTerms}
                        onChange={e => setNewPaymentTerms(e.target.value)}
                        placeholder="28 DDL Boleto"
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Total da Proposta Calculado: <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">R$ {(calcNewSubtotal() + (calcNewSubtotal() * newTaxRate) / 100 + Number(newFreight)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSupplier(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={submittingSupplier}
                        className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                      >
                        {submittingSupplier ? 'Gravando...' : 'Salvar Proposta no Mapa'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Tabela do Mapa Comparativo Lado a Lado (Print 2) */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 w-10 text-center font-bold">#</th>
                      <th className="py-3 px-3 min-w-[200px] font-bold">Item & Especificação</th>
                      <th className="py-3 px-2 w-16 text-center font-bold">Qtd</th>
                      <th className="py-3 px-2 w-14 text-center font-bold">Unid</th>
                      
                      {/* Colunas dos Fornecedores */}
                      {suppliers.map((s, idx) => {
                        const isBestTotal = lowestTotalAmount !== null && Number(s.total_amount) === lowestTotalAmount;
                        return (
                          <th
                            key={s.id}
                            className={`py-3 px-3 min-w-[220px] text-center border-l border-slate-200 dark:border-slate-700 ${
                              s.is_winner
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                                : isBestTotal
                                ? 'bg-blue-50/60 dark:bg-blue-950/30'
                                : ''
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Fornecedor {String.fromCharCode(65 + idx)}
                              </span>
                              <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[200px]">
                                {s.supplier_name}
                              </span>
                              {s.cnpj && <span className="text-[10px] text-slate-400">{s.cnpj}</span>}
                              {s.is_winner ? (
                                <span className="mt-1 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-xs">
                                  <Trophy className="w-3 h-3" /> VENCEDOR
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSupplier(s.id, s.supplier_name)}
                                  className="mt-1 text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 p-0.5"
                                  title="Remover esta proposta de fornecedor do mapa"
                                >
                                  <Trash2 className="w-3 h-3" /> Remover
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      })}

                      {suppliers.length === 0 && (
                        <th className="py-3 px-4 text-center text-slate-400 font-normal italic">
                          Nenhum fornecedor cadastrado para comparação ainda.
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => {
                      const lowestPrice = getLowestItemPrice(it.id);

                      return (
                        <tr key={it.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {it.mat_name || it.item_description}
                                </div>
                                {it.mat_code && <div className="text-[10px] text-slate-400">Cód: {it.mat_code}</div>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(it)}
                                  className="text-slate-400 hover:text-blue-500 p-1 rounded transition-all cursor-pointer"
                                  title="Editar descrição, quantidade e unidade deste item"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(it.id, it.mat_name || it.item_description || 'Item')}
                                  className="opacity-40 hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded transition-all cursor-pointer"
                                  title="Remover este item do comparativo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleEditItemQuantity(it)}
                              className="font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                              title="Clique para alterar a quantidade"
                            >
                              <span>{it.quantity}</span>
                              <Edit2 className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-500 uppercase">{it.unit}</td>

                          {suppliers.map(s => {
                            const pMap = typeof s.items_prices === 'string' ? JSON.parse(s.items_prices) : s.items_prices || {};
                            const unitPrice = Number(pMap[it.id]) || 0;
                            const totalItemPrice = unitPrice * it.quantity;
                            const isLowest = lowestPrice !== null && unitPrice === lowestPrice && unitPrice > 0;

                            return (
                              <td
                                key={s.id}
                                className={`py-2.5 px-3 text-center border-l border-slate-200 dark:border-slate-800 ${
                                  isLowest ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-semibold' : ''
                                }`}
                              >
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs ${isLowest ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                      R$ {unitPrice.toFixed(2)}
                                    </span>
                                    {isLowest && (
                                      <span className="px-1 py-0.2 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[9px] rounded font-bold">
                                        Menor
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    Sub: R$ {totalItemPrice.toFixed(2)}
                                  </span>
                                </div>
                              </td>
                            );
                          })}

                          {suppliers.length === 0 && (
                            <td className="text-center text-slate-400 italic py-2">--</td>
                          )}
                        </tr>
                      );
                    })}

                    {/* Linhas de Fechamento / Totais (Print 2) */}
                    <tr className="bg-slate-50 dark:bg-slate-800/80 font-semibold border-t-2 border-slate-300 dark:border-slate-700">
                      <td colSpan={4} className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                        Subtotal de Itens:
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-2.5 px-3 text-center border-l border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                          R$ {Number(s.subtotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                      <td colSpan={4} className="py-2 px-3 text-right text-[11px]">
                        Alíquota de Impostos (%):
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-2 px-3 text-center border-l border-slate-200 dark:border-slate-700">
                          {Number(s.tax_rate || 0)}%
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                      <td colSpan={4} className="py-2 px-3 text-right text-[11px]">
                        Total de Impostos (R$):
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-2 px-3 text-center border-l border-slate-200 dark:border-slate-700">
                          R$ {Number(s.tax_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                      <td colSpan={4} className="py-2 px-3 text-right text-[11px]">
                        Transporte / Frete (R$):
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-2 px-3 text-center border-l border-slate-200 dark:border-slate-700">
                          R$ {Number(s.freight_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>

                    {/* CUSTO TOTAL FINAL */}
                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t border-slate-300 dark:border-slate-700">
                      <td colSpan={4} className="py-3 px-3 text-right text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                        Custo Total da Proposta:
                      </td>
                      {suppliers.map(s => {
                        const isBestTotal = lowestTotalAmount !== null && Number(s.total_amount) === lowestTotalAmount;
                        return (
                          <td
                            key={s.id}
                            className={`py-3 px-3 text-center border-l border-slate-200 dark:border-slate-700 ${
                              isBestTotal
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm'
                                : 'text-slate-900 dark:text-white text-xs'
                            }`}
                          >
                            <div>
                              R$ {Number(s.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              {isBestTotal && (
                                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">
                                  ★ Melhor Preço Global
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Prazo e Condições */}
                    <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-[11px]">
                      <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-medium">
                        Prazo de Entrega:
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-2 px-3 text-center border-l border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {s.delivery_deadline_days ? `${s.delivery_deadline_days} dias úteis` : 'A combinar'}
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-[11px]">
                      <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-medium">
                        Condição de Pagamento:
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-2 px-3 text-center border-l border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {s.payment_terms || 'Boleto 28 DDL'}
                        </td>
                      ))}
                    </tr>

                    {/* Botões de Ação para cada Fornecedor */}
                    <tr className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                      <td colSpan={4} className="py-3 px-3 text-right font-medium text-slate-400 text-xs">
                        Homologação Sabrar:
                      </td>
                      {suppliers.map(s => (
                        <td key={s.id} className="py-3 px-3 text-center border-l border-slate-200 dark:border-slate-700">
                          {s.is_winner ? (
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="w-4 h-4" /> Proposta Vencedora
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSetWinner(s.id, s.supplier_name)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 !text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 mx-auto"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              Definir Vencedor
                            </button>
                          )}
                          <a
                            href={api.exportQuotationOCUrl(activeQuotationId!, s.supplier_id || s.id)}
                            download={`Ordem_de_Compra_${(s.supplier_name || 'Fornecedor').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`}
                            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 rounded-lg transition-all"
                            title={`Exportar Ordem de Compra para ${s.supplier_name} em Excel editável`}
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            <span>Exportar OC (Excel)</span>
                          </a>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl flex items-center justify-between text-xs text-slate-500">
          <div>
            * Mapa comparativo auditado conforme as diretrizes de suprimentos e engenharia Sabrar.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>

        {/* Modal de Edição de Item do Mapa Comparativo (Item 15) */}
        {editingItem && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-dark-800 pb-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  Editar Item do Mapa Comparativo
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditItem} className="space-y-3 text-xs">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">
                      Descrição / Nome do Material *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      (Busca inteligente ou texto livre)
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editItemName}
                      onChange={(e) => handleEditMaterialSearch(e.target.value)}
                      placeholder="Digite para buscar na base ou escrever livremente..."
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-medium"
                    />
                    {loadingEditSuggestions && (
                      <div className="absolute right-3 top-2.5 text-[10px] text-slate-400 animate-pulse">
                        Buscando base...
                      </div>
                    )}
                  </div>
                  {editMaterialSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-dark-850 border border-dark-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-dark-800">
                      <div className="px-3 py-1 bg-dark-800 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                        <span>{editMaterialSuggestions.length} opções encontradas na base SABRAR</span>
                        <button type="button" onClick={() => setEditMaterialSuggestions([])} className="hover:text-white">✕</button>
                      </div>
                      {editMaterialSuggestions.map((mat) => (
                        <div
                          key={mat.id}
                          onClick={() => handleSelectEditMaterialSuggestion(mat)}
                          className="p-2.5 hover:bg-dark-750 cursor-pointer text-xs transition-colors"
                        >
                          <div className="font-bold text-white flex items-center gap-2">
                            <span className="font-mono text-[10px] text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-500/30">
                              {mat.code}
                            </span>
                            <span>{mat.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Unidade: <strong className="text-emerald-400">{mat.unit}</strong> {mat.category ? `• Cat: ${mat.category}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={editItemQty}
                      onChange={(e) => setEditItemQty(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Unidade de Medida *
                    </label>
                    <input
                      type="text"
                      required
                      value={editItemUnit}
                      onChange={(e) => setEditItemUnit(e.target.value)}
                      placeholder="und, m, kg, cx"
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white uppercase focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-3 py-1.5 rounded-xl border border-dark-700 text-slate-300 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditItem}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
                  >
                    {savingEditItem ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
