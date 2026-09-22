import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Phone, Mail, FileText, Check, X } from 'lucide-react';
import { Supplier } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const SuppliersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
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
      const data = await api.getSuppliers(search);
      setSuppliers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.createSupplier({
        name,
        corporate_name: corporateName,
        cnpj,
        contact_person: contactPerson,
        phone,
        email,
        materials_supplied: materialsSupplied,
        notes,
        userId: currentUser?.id
      });
      setIsModalOpen(false);
      setName('');
      setCorporateName('');
      setCnpj('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setMaterialsSupplied('');
      setNotes('');
      await fetchSuppliers();
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar fornecedor');
    }
  };

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
              Fornecedores Parceiros
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cadastro de fornecedores habituais vinculado a compras e materiais
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Fornecedor</span>
        </button>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3 hover:border-sabrar-500/40 transition-all">
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

            <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-dark-750">
              {s.contact_person && (
                <div className="font-medium text-slate-200">Contato: {s.contact_person}</div>
              )}
              {s.phone && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-sabrar-400" /> {s.phone}
                </div>
              )}
              {s.email && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-sabrar-400" /> {s.email}
                </div>
              )}
            </div>

            {s.materials_supplied && (
              <div className="p-2.5 bg-dark-850 rounded-2xl text-[11px] text-slate-300 border border-dark-700">
                <span className="font-bold text-sabrar-400">Materiais: </span>
                {s.materials_supplied}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Cadastro Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
              <div className="font-extrabold text-sm text-white">Novo Fornecedor</div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-4 sm:p-6 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nome Fantasia *</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">E-mail Comercial</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendas@fornecedor.com.br"
                    className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Materiais Fornecidos</label>
                <input
                  type="text"
                  value={materialsSupplied}
                  onChange={(e) => setMaterialsSupplied(e.target.value)}
                  placeholder="Ex: Dutos MPU, Isolamento Armaflex, Gás R-410A"
                  className="w-full p-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-dark-750">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-300 font-bold hover:bg-dark-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sabrar-600 text-white font-bold hover:bg-sabrar-500 shadow-md shadow-sabrar-600/30"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
