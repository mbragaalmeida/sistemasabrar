import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, Search, Phone, Mail, FileText, Check, X, Trash2, User, Edit3, Package, Tag, PlusCircle } from 'lucide-react';
import { Supplier } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ContactRow {
  name: string;
  phone?: string;
  email?: string;
  role?: string;
}

const COMMON_CATEGORIES = [
  'Tubulação & Conexões de Cobre',
  'Isolamento Térmico (Armaflex)',
  'Dutos MPU & Chapas',
  'Gases Refrigerantes',
  'Climatização VRF / Split',
  'Elétrica & Comandos',
  'Fixação & Suportes',
  'EPIs & Segurança',
  'Ferramentas & Instrumentação',
  'Civil & Hidráulica',
  'Válvulas & Registros'
];

// Helper para normalizar texto removendo acentos e pontuações
const normalizeText = (text: string = ''): string => {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

// Helper para converter string, JSON ou array em lista de categorias
const parseCategories = (categories: any, fallbackCategory?: string | null): string[] => {
  if (Array.isArray(categories)) {
    return categories.map(c => String(c).trim()).filter(Boolean);
  }
  if (typeof categories === 'string' && categories.trim()) {
    try {
      if (categories.startsWith('[') && categories.endsWith(']')) {
        const parsed = JSON.parse(categories);
        if (Array.isArray(parsed)) return parsed.map(c => String(c).trim()).filter(Boolean);
      }
    } catch (_) {}
    return categories.split(',').map(c => c.trim()).filter(Boolean);
  }
  if (fallbackCategory && typeof fallbackCategory === 'string' && fallbackCategory.trim()) {
    return [fallbackCategory.trim()];
  }
  return [];
};

// Helper para converter contatos
const parseContacts = (contacts: any, person?: string | null, phone?: string | null, email?: string | null): ContactRow[] => {
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts.map(c => ({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      role: c.role || 'Vendas'
    }));
  }
  if (typeof contacts === 'string' && contacts.trim()) {
    try {
      const parsed = JSON.parse(contacts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(c => ({
          name: c.name || '',
          phone: c.phone || '',
          email: c.email || '',
          role: c.role || 'Vendas'
        }));
      }
    } catch (_) {}
  }
  if (person || phone || email) {
    return [{
      name: person || '',
      phone: phone || '',
      email: email || '',
      role: 'Vendas'
    }];
  }
  return [];
};

export const SuppliersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([
    { name: '', phone: '', email: '', role: 'Vendas' }
  ]);
  const [materialsSupplied, setMaterialsSupplied] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.getSuppliers();
      // Ordenação Alfabética (Item 14)
      const sorted = (data || []).sort((a: Supplier, b: Supplier) =>
        (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
      );
      setSuppliers(sorted);
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
    setCategories([]);
    setCustomCategoryInput('');
    setContacts([{ name: '', phone: '', email: '', role: 'Vendas' }]);
    setMaterialsSupplied('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name || '');
    setCorporateName(s.corporate_name || '');
    setCnpj(s.cnpj || '');
    
    // Categorias múltiplas (Item 13)
    const parsedCats = parseCategories(s.categories, s.category);
    setCategories(parsedCats);
    setCustomCategoryInput('');

    // Múltiplos contatos/vendedores (Item 12)
    const parsedContacts = parseContacts(s.contacts, s.contact_person, s.phone, s.email);
    setContacts(parsedContacts.length > 0 ? parsedContacts : [{ name: '', phone: '', email: '', role: 'Vendas' }]);

    setMaterialsSupplied(s.materials_supplied || '');
    setNotes(s.notes || '');
    setIsModalOpen(true);
  };

  const handleAddContact = () => {
    setContacts(prev => [...prev, { name: '', phone: '', email: '', role: 'Vendas' }]);
  };

  const handleRemoveContact = (idx: number) => {
    setContacts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleContactChange = (idx: number, field: keyof ContactRow, val: string) => {
    setContacts(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCategoryInput.trim() && !categories.includes(customCategoryInput.trim())) {
      setCategories(prev => [...prev, customCategoryInput.trim()]);
      setCustomCategoryInput('');
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const validContacts = contacts.filter(c => (c.name || '').trim() || (c.phone || '').trim() || (c.email || '').trim());
      const primaryContact: ContactRow = validContacts[0] || { name: '', phone: '', email: '', role: 'Vendas' };

      const payload = {
        name: name.trim(),
        corporate_name: corporateName.trim() || null,
        cnpj: cnpj.trim() || null,
        category: categories[0] || null,
        categories: categories,
        contacts: validContacts,
        contact_person: primaryContact.name?.trim() || null,
        phone: primaryContact.phone?.trim() || null,
        email: primaryContact.email?.trim() || null,
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

  // Lista de todas as categorias dinâmicas (Padrão + Cadastradas por usuários)
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    COMMON_CATEGORIES.forEach(c => set.add(c));
    suppliers.forEach(s => {
      const cats = parseCategories(s.categories, s.category);
      cats.forEach(c => {
        if (c.trim()) set.add(c.trim());
      });
    });
    return Array.from(set);
  }, [suppliers]);

  // Filtragem flexível por produto vendido, vendedor, nome, cnpj ou categorias
  const filteredSuppliers = useMemo(() => {
    let result = suppliers;

    // 1. Filtro por Categoria Selecionada
    if (selectedCategory !== 'all') {
      const normCat = normalizeText(selectedCategory);

      // Mapeamento inteligente de palavras-chave para categorias com termos sinônimos ou compostos
      const categoryKeywords: Record<string, string[]> = {
        'tubulação & conexões de cobre': ['cobre', 'tubulac', 'conexo', 'solda'],
        'isolamento térmico (armaflex)': ['armaflex', 'isolamento', 'isotubo', 'la de vidro', 'la de rocha', 'fita tdc', 'vedacao', 'manta', 'termo'],
        'dutos mpu & chapas': ['duto', 'mpu', 'chapa', 'galvaniz', 'difus', 'grelha', 'flange'],
        'gases refrigerantes': ['gas', 'refrigeran', 'r410', 'r-410', 'r22', 'r-22', 'r134', 'r-134', 'r32', 'r-32', 'r407', 'r-407', 'nitrogenio', 'oxigenio', 'acetileno'],
        'climatização vrf / split': ['climatiz', 'vrf', 'split', 'ar condicionado', 'chiller', 'fancoil', 'evaporadora', 'condensadora'],
        'elétrica & comandos': ['eletric', 'cabo', 'fio', 'disjuntor', 'quadro', 'sensor', 'termostato', 'painel'],
        'fixação & suportes': ['fixac', 'suporte', 'chumbador', 'barra roscada', 'tirante', 'parafuso', 'porca', 'arruela'],
        'epis & segurança': ['epi', 'seguranca', 'bota', 'luva', 'oculos', 'capacete', 'cinto'],
        'ferramentas & instrumentação': ['ferramenta', 'manometro', 'manifold', 'bomba de vacuo', 'vacuometro', 'alicate', 'maquina'],
        'civil & hidráulica': ['hidraulic', 'civil', 'pvc', 'registro', 'valvula', 'cano', 'conexao hidraulica', 'construcao', 'gesso', 'drywall'],
        'válvulas & registros': ['valvula', 'registro', 'esfera', 'solenoide', 'globo', 'borboleta', 'retencao', 'filtro y']
      };

      const customKeywords = categoryKeywords[normCat] || normCat.split(/[\s,&/()\-]+/).filter(w => w.length >= 3);

      result = result.filter(s => {
        const sCats = parseCategories(s.categories, s.category).map(normalizeText);
        const sMaterials = normalizeText(s.materials_supplied || '');
        const sName = normalizeText(s.name || '');

        // Match direto em categorias cadastradas
        if (sCats.some(c => c.includes(normCat) || normCat.includes(c))) return true;

        // Match direto no texto de materiais fornecidos
        if (sMaterials.includes(normCat)) return true;

        // Match por palavras-chave relevantes
        if (customKeywords.length > 0) {
          const matchCatWord = sCats.some(c => customKeywords.some(kw => c.includes(kw)));
          const matchMatWord = customKeywords.some(kw => sMaterials.includes(kw) || sName.includes(kw));
          if (matchCatWord || matchMatWord) return true;
        }

        return false;
      });
    }

    // 2. Filtro textual por nome, material, vendedor, cnpj, etc.
    if (search.trim()) {
      const q = normalizeText(search);
      result = result.filter(s => {
        const matchesName = normalizeText(s.name || '').includes(q);
        const matchesCorp = normalizeText(s.corporate_name || '').includes(q);
        const matchesMaterials = normalizeText(s.materials_supplied || '').includes(q);
        const matchesNotes = normalizeText(s.notes || '').includes(q);
        const matchesCnpj = (s.cnpj || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) || (s.cnpj || '').toLowerCase().includes(q);

        const sCats = parseCategories(s.categories, s.category).map(normalizeText).join(' ');
        const matchesCats = sCats.includes(q);

        const contactsList = parseContacts(s.contacts, s.contact_person, s.phone, s.email);
        const matchesContacts = contactsList.some(c =>
          normalizeText(c.name || '').includes(q) ||
          (c.phone || '').includes(q) ||
          normalizeText(c.email || '').includes(q)
        );

        return matchesName || matchesCorp || matchesMaterials || matchesNotes || matchesCnpj || matchesCats || matchesContacts;
      });
    }

    // Ordenação alfabética (Item 14)
    return [...result].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [suppliers, search, selectedCategory]);

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
            Gestão de fornecedores em ordem alfabética com múltiplos contatos e categorias
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

      {/* Barra de Pesquisa */}
      <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, categoria, material ou vendedor..."
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
            <strong className="text-white">{filteredSuppliers.length}</strong> fornecedor(es) {selectedCategory !== 'all' ? `em "${selectedCategory}"` : 'em ordem alfabética'}
          </div>
        </div>

        {/* Chips de Categorias para Busca Rápida */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-dark-800 no-scrollbar">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1">Filtro de Categoria:</span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-sabrar-600 text-white shadow-xs'
                : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-750'
            }`}
          >
            Todos
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                selectedCategory === cat
                  ? 'bg-sabrar-600 text-white shadow-xs'
                  : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-750'
              }`}
            >
              <span>{cat}</span>
              {selectedCategory === cat && (
                <X className="w-3 h-3 ml-0.5 text-white/80 hover:text-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Fornecedores */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Carregando catálogo de fornecedores...</div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 bg-dark-900 border border-dark-750 rounded-3xl text-center text-slate-400 text-xs space-y-2">
          <p>Nenhum fornecedor encontrado para {selectedCategory !== 'all' ? `a categoria "${selectedCategory}"` : ''} {search ? `o termo "${search}"` : ''}.</p>
          <div className="flex items-center justify-center gap-3 pt-1">
            {(selectedCategory !== 'all' || search) && (
              <button
                onClick={() => { setSelectedCategory('all'); setSearch(''); }}
                className="text-xs text-slate-300 bg-dark-800 hover:bg-dark-750 px-3 py-1.5 rounded-xl border border-dark-700"
              >
                Limpar Filtros
              </button>
            )}
            <button onClick={handleOpenCreate} className="text-sabrar-400 font-bold hover:underline">
              + Cadastrar novo fornecedor agora
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => {
            const supplierCats = parseCategories(s.categories, s.category);
            const supplierContacts = parseContacts(s.contacts, s.contact_person, s.phone, s.email);

            return (
              <div
                key={s.id}
                className="bg-dark-900 border border-dark-750 hover:border-dark-700 p-5 rounded-3xl shadow-lg flex flex-col justify-between transition-all group gap-4"
              >
                <div className="space-y-3">
                  {/* Top Bar with Name & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-white text-base truncate group-hover:text-sabrar-400 transition-colors">
                        {s.name}
                      </h3>
                      {s.corporate_name && (
                        <p className="text-[11px] text-slate-400 truncate">{s.corporate_name}</p>
                      )}
                      {s.cnpj && (
                        <span className="inline-block mt-0.5 text-[10px] font-mono font-bold text-slate-400 bg-dark-850 px-2 py-0.5 rounded-lg border border-dark-750">
                          CNPJ: {s.cnpj}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(s)}
                        className="p-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-amber-400 border border-dark-700 hover:border-amber-500/40 transition-colors cursor-pointer"
                        title="Editar fornecedor, contatos e categorias"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {canDeleteSupplier && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSupplier(s.id, s.name)}
                          className="p-2 rounded-xl bg-dark-850 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-dark-700 hover:border-rose-700/60 transition-colors"
                          title="Excluir fornecedor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Categorias (Item 13) */}
                  {supplierCats.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {supplierCats.map((cat, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-amber-400" />
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Vendedores & Contatos (Item 12) */}
                  <div className="space-y-2 pt-2 border-t border-dark-750">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Vendedores & Contatos ({supplierContacts.length})
                    </span>
                    {supplierContacts.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic">Nenhum vendedor cadastrado</div>
                    ) : (
                      <div className="space-y-1.5">
                        {supplierContacts.map((c, i) => (
                          <div key={i} className="p-2.5 bg-dark-850 rounded-xl border border-dark-750 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white flex items-center gap-1">
                                <User className="w-3 h-3 text-sabrar-400" />
                                {c.name || 'Contato'}
                              </span>
                              {c.role && (
                                <span className="text-[9px] font-semibold text-slate-400 bg-dark-800 px-1.5 py-0.5 rounded">
                                  {c.role}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                              {c.phone && (
                                <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-sabrar-300">
                                  <Phone className="w-3 h-3 text-slate-500" /> {c.phone}
                                </a>
                              )}
                              {c.email && (
                                <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-sabrar-300 truncate max-w-[200px]">
                                  <Mail className="w-3 h-3 text-slate-500" /> {c.email}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Produtos / Materiais Fornecidos */}
                <div className="pt-2 border-t border-dark-750">
                  {s.materials_supplied ? (
                    <div className="space-y-1">
                      <span className="text-[10px] text-sabrar-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Linhas de Produtos
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {s.materials_supplied.split(/[,;\n]+/).map((item, idx) => {
                          const trimmed = item.trim();
                          if (!trimmed) return null;
                          return (
                            <span key={idx} className="bg-sabrar-950/70 text-sabrar-300 border border-sabrar-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-lg">
                              {trimmed}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">Sem linhas cadastradas</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cadastro / Edição Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col text-slate-100 max-h-[92vh]">
            <div className="p-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
              <div className="font-extrabold text-sm text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-sabrar-400" />
                <span>{editingSupplier ? 'Editar Fornecedor, Contatos & Categorias' : 'Novo Fornecedor Parceiro'}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
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

              {/* Categorias do Fornecedor (Item 13) */}
              <div className="p-3.5 bg-dark-850 rounded-2xl border border-dark-700 space-y-2">
                <label className="block font-bold text-amber-400">
                  Categorias do Fornecedor (Selecione uma ou mais)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_CATEGORIES.map((cat) => {
                    const isSelected = categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`text-[11px] px-2.5 py-1 rounded-xl border font-semibold transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs'
                            : 'bg-dark-800 text-slate-400 border-dark-750 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCategory(e);
                      }
                    }}
                    placeholder="Adicionar outra categoria personalizada..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-dark-900 border border-dark-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Vendedores, Telefones e E-mails (Item 12) */}
              <div className="p-3.5 bg-dark-850 rounded-2xl border border-dark-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-sabrar-300">
                      Vendedores & Contatos Comerciais
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Cadastre mais de um vendedor, telefone e e-mail para este fornecedor
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 text-xs font-bold hover:bg-sabrar-900 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Vendedor</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {contacts.map((c, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-dark-900 border border-dark-750 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-4">
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                          placeholder="Nome do Vendedor"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-dark-850 border border-dark-700 text-white text-xs focus:outline-none focus:border-sabrar-500 font-medium"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <input
                          type="text"
                          value={c.phone}
                          onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                          placeholder="Telefone / WhatsApp"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-dark-850 border border-dark-700 text-white text-xs focus:outline-none focus:border-sabrar-500"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-4">
                        <input
                          type="email"
                          value={c.email}
                          onChange={(e) => handleContactChange(idx, 'email', e.target.value)}
                          placeholder="E-mail Comercial"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-dark-850 border border-dark-700 text-white text-xs focus:outline-none focus:border-sabrar-500"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(idx)}
                          disabled={contacts.length === 1}
                          className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* O que o fornecedor vende */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-300">
                  Produtos & Linhas Comercializadas (Separados por vírgula)
                </label>
                <textarea
                  rows={2}
                  value={materialsSupplied}
                  onChange={(e) => setMaterialsSupplied(e.target.value)}
                  placeholder="Ex: Tubos de Cobre, Isolamento Armaflex, Gás R-410A, Dutos MPU..."
                  className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Observações Gerais / Condições Comerciais</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Faturamento 28 dias, entrega em até 48h, frete grátis..."
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
                  className="px-5 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold cursor-pointer shadow-md shadow-sabrar-600/30 transition-all active:scale-95"
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
