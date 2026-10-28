import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, Search, Phone, Mail, FileText, Check, X, Trash2, User, Edit3, Package, Sparkles } from 'lucide-react';
import { Supplier } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const SuppliersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Permissão de exclusão: restrito a Administradores e Emily
  const canDeleteSupplier = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'compras_solicitacoes' ||
    /emily/i.test(currentUser?.name || '') ||
    /emily/i.test(currentUser?.email || '')
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [corporateName, setCorporateName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [materialsSupplied, setMaterialsSupplied] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setName('');
    setCorporateName('');
    setCnpj('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setMaterialsSupplied('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name || '');
    setCorporateName(s.corporate_name || '');
    setCnpj(s.cnpj || '');
    setContactPerson(s.contact_person || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setMaterialsSupplied(s.materials_supplied || '');
    setNotes(s.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const payload = {
        name: name.trim(),
        corporate_name: corporateName.trim() || null,
        cnpj: cnpj.trim() || null,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        materials_supplied: materialsSupplied.trim() || null,
        notes: notes.trim() || null,
        userId: currentUser?.id
      };

      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, payload);
      } else {
        await api.createSupplier(payload);
      }

      setIsModalOpen(false);
      await fetchSuppliers();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao salvar fornecedor');
    }
  };

  const handleDeleteSupplier = async (supplierId: number, supplierName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o fornecedor "${supplierName}"? Esta ação removerá o registro e desvinculará pedidos associados.`)) {
      return;
    }

    try {
      await api.deleteSupplier(supplierId, currentUser?.id);
      await fetchSuppliers();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao excluir fornecedor');
    }
  };

  // Filtragem flexível por produto vendido, vendedor, nome ou cnpj
  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase().trim();
    return suppliers.filter(s => {
      const matchesName = (s.name || '').toLowerCase().includes(q);
      const matchesCorp = (s.corporate_name || '').toLowerCase().includes(q);
      const matchesPerson = (s.contact_person || '').toLowerCase().includes(q);
      const matchesMaterials = (s.materials_supplied || '').toLowerCase().includes(q);
      const matchesNotes = (s.notes || '').toLowerCase().includes(q);
      const matchesCnpj = (s.cnpj || '').includes(q);
      const matchesPhone = (s.phone || '').includes(q);
      const matchesEmail = (s.email || '').toLowerCase().includes(q);

      return matchesName || matchesCorp || matchesPerson || matchesMaterials || matchesNotes || matchesCnpj || matchesPhone || matchesEmail;
    });
  }, [suppliers, search]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Truck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Fornecedores Parceiros & Vendedores
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão de fornecedores com produtos e linhas comercializadas por cada vendedor
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Fornecedor</span>
        </button>
      </div>

      {/* Barra de Pesquisa e Filtro por Produtos Vendidos */}
      <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por produto/material que o vendedor vende (ex: cobre, duto, armaflex, valvula, gás), vendedor ou fornecedor..."
              className="w-full pl-10 pr-10 py-2.5 bg-dark-850 border border-dark-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 shrink-0 font-medium">
            <strong className="text-white">{filteredSuppliers.length}</strong> fornecedor(es) encontrado(s)
          </div>
        </div>

        {/* Chips de Categorias Populares para Busca Rápida */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs pt-1 border-t border-dark-800">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1">Filtros Rápidos:</span>
          {[
            { label: 'Todos', query: '' },
            { label: 'Tubos de Cobre', query: 'cobre' },
            { label: 'Dutos & MPU', query: 'duto' },
            { label: 'Isolamento Armaflex', query: 'isolamento' },
            { label: 'Gases Refrigerantes', query: 'gás' },
            { label: 'Válvulas & Registros', query: 'válvula' },
            { label: 'Fixação & Perfilados', query: 'perfilado' },
            { label: 'Elétrica & Cabos', query: 'elétrica' }
          ].map(chip => (
            <button
              key={chip.label}
              onClick={() => setSearch(chip.query)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                (!search && !chip.query) || (search.toLowerCase() === chip.query.toLowerCase())
                  ? 'bg-sabrar-600 text-white shadow-xs'
                  : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-700 hover:border-slate-600'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">
          Carregando fornecedores e linhas de produtos...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-dark-900 border border-dark-750 rounded-3xl p-8 text-center text-xs text-slate-400 space-y-2">
          <Package className="w-8 h-8 text-slate-600 mx-auto mb-1" />
          <p className="font-bold text-white text-sm">Nenhum fornecedor encontrado para "{search}"</p>
          <p className="text-slate-500">Tente buscar por outro termo, material vendido ou limpe o campo de busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSuppliers.map((s) => (
            <div key={s.id} className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3 hover:border-sabrar-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                      {s.name}
                    </h3>
                    {s.corporate_name && (
                      <div className="text-xs text-slate-400 mt-0.5">{s.corporate_name}</div>
                    )}
                    {s.cnpj && (
                      <div className="text-[11px] font-mono text-sabrar-400/80 mt-0.5">CNPJ: {s.cnpj}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(s)}
                      className="p-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-amber-400 border border-dark-700 hover:border-amber-500/40 transition-colors cursor-pointer shadow-xs active:scale-95"
                      title="Editar fornecedor e produtos que ele vende"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {canDeleteSupplier && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSupplier(s.id, s.name)}
                        className="p-1.5 rounded-xl bg-dark-850 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-dark-700 hover:border-rose-700/60 transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
                        title={`Excluir fornecedor "${s.name}" (Admins e Emily)`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Vendedor e Contatos */}
                <div className="space-y-1.5 text-xs text-slate-300 pt-2.5 border-t border-dark-750 mt-3">
                  {s.contact_person ? (
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5 bg-dark-850 px-2.5 py-1.5 rounded-xl border border-dark-700">
                      <User className="w-3.5 h-3.5 text-sabrar-400 shrink-0" />
                      <span>Vendedor: <strong className="text-white">{s.contact_person}</strong></span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">Vendedor não especificado</div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-sabrar-400 shrink-0" /> {s.phone}
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-1.5 text-slate-400 truncate">
                      <Mail className="w-3.5 h-3.5 text-sabrar-400 shrink-0" /> {s.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Produtos / Materiais Vendidos */}
              <div className="pt-2">
                {s.materials_supplied ? (
                  <div className="p-3 bg-dark-850/80 rounded-2xl text-xs text-slate-300 border border-dark-700/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-sabrar-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3 text-sabrar-400" />
                        <span>Produtos & Linhas Fornecidas</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.materials_supplied.split(/[,;\n]+/).map((item, idx) => {
                        const trimmed = item.trim();
                        if (!trimmed) return null;
                        return (
                          <span key={idx} className="bg-sabrar-950/70 text-sabrar-300 border border-sabrar-500/30 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {trimmed}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-dark-850/40 rounded-2xl text-[11px] text-slate-500 border border-dark-800 italic flex items-center justify-between">
                    <span>Nenhum produto cadastrado</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(s)}
                      className="text-[10px] text-amber-400 hover:underline font-bold"
                    >
                      + Adicionar o que vende
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastro / Edição Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
            <div className="p-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
              <div className="font-extrabold text-sm text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-sabrar-400" />
                <span>{editingSupplier ? 'Editar Fornecedor & Produtos Vendidos' : 'Novo Fornecedor Parceiro'}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-4 sm:p-6 space-y-3.5 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nome Fantasia do Fornecedor *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: ClimaTech Distribuidora"
                  className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white font-bold focus:outline-none focus:ring-2 focus:ring-sabrar-500 placeholder-slate-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Razão Social</label>
                  <input
                    type="text"
                    value={corporateName}
                    onChange={(e) => setCorporateName(e.target.value)}
                    placeholder="Ex: ClimaTech Refrigeração Ltda"
                    className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nome do Vendedor / Representante Comercial</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Ex: Carlos Oliveira (Vendas Técnicas)"
                  className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(21) 99999-9999"
                    className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">E-mail Comercial</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos.vendas@fornecedor.com.br"
                    className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              {/* O QUE O VENDEDOR VENDE (PRODUTOS / LINHAS) */}
              <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 space-y-1.5">
                <label className="block font-bold text-amber-400">
                  O que este vendedor/fornecedor vende? (Produtos e Linhas) *
                </label>
                <p className="text-[11px] text-slate-400">
                  Insira os produtos separados por vírgula. Isso permitirá encontrar este fornecedor ao pesquisar por qualquer um desses itens.
                </p>
                <textarea
                  rows={3}
                  value={materialsSupplied}
                  onChange={(e) => setMaterialsSupplied(e.target.value)}
                  placeholder="Ex: Tubos de Cobre, Isolamento Armaflex, Gás R-410A, Dutos MPU, Difusores, Válvulas Esfera, Parafusos e Perfilados"
                  className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Observações Gerais / Condições Comerciais</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Faturamento 28 dias, entrega em até 48h, frete grátis acima de R$ 2.000"
                  className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-dark-750">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-300 font-bold hover:bg-dark-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sabrar-600 text-white font-bold hover:bg-sabrar-500 shadow-md shadow-sabrar-600/30 cursor-pointer"
                >
                  {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
