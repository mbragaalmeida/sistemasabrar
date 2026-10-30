import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Phone, Mail, MapPin, User, Edit3, Trash2, CheckCircle2, Building, RefreshCw, ArrowRight } from 'lucide-react';
import { Client } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ClientsPageProps {
  onNavigate?: (page: string, id?: number) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [onlyRecurrent, setOnlyRecurrent] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [name, setName] = useState('');
  const [corporateName, setCorporateName] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('RJ');
  const [segment, setSegment] = useState('');
  const [isRecurrent, setIsRecurrent] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await api.getClients(search, onlyRecurrent ? true : undefined);
      setClients(data || []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [search, onlyRecurrent]);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setName('');
    setCorporateName('');
    setCnpjCpf('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setState('RJ');
    setSegment('');
    setIsRecurrent(true);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditingClient(c);
    setName(c.name || '');
    setCorporateName(c.corporate_name || '');
    setCnpjCpf(c.cnpj_cpf || '');
    setContactPerson(c.contact_person || '');
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setCity(c.city || '');
    setState(c.state || 'RJ');
    setSegment(c.segment || '');
    setIsRecurrent(c.is_recurrent !== false);
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome do cliente.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        corporate_name: corporateName.trim() || null,
        cnpj_cpf: cnpjCpf.trim() || null,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        segment: segment.trim() || null,
        is_recurrent: isRecurrent,
        notes: notes.trim() || null,
        userId: currentUser?.id || 1
      };

      if (editingClient) {
        await api.updateClient(editingClient.id, payload);
      } else {
        await api.createClient(payload);
      }

      setIsModalOpen(false);
      await fetchClients();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (c: Client) => {
    if (!window.confirm(`Tem certeza que deseja remover o cliente "${c.name}"?`)) return;
    try {
      await api.deleteClient(c.id, currentUser?.id);
      await fetchClients();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cliente.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Clientes Recorrentes
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão cadastral de clientes, parceiros recorrentes e dados de contato para elaboração de orçamentos e obras
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-dark-900 p-3 sm:p-4 rounded-3xl border border-dark-750 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ, contato ou cidade..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-dark-850 border border-dark-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setOnlyRecurrent(!onlyRecurrent)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              onlyRecurrent
                ? 'bg-sabrar-950 text-sabrar-300 border-sabrar-500/50 shadow-sm'
                : 'bg-dark-850 text-slate-400 border-dark-700 hover:text-white'
            }`}
          >
            Apenas Recorrentes
          </button>
          <span className="text-xs text-slate-500">
            {clients.length} cliente(s)
          </span>
        </div>
      </div>

      {/* Grid de Clientes */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando base de clientes...
        </div>
      ) : clients.length === 0 ? (
        <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-slate-400 p-6 space-y-2">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">Nenhum cliente encontrado</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {search ? 'Tente ajustar os termos da pesquisa.' : 'Cadastre o primeiro cliente clicando no botão acima.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div
              key={c.id}
              className="bg-dark-900 rounded-3xl border border-dark-750 p-4 sm:p-5 flex flex-col justify-between hover:border-dark-700 transition-all shadow-md group space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-8 h-8 rounded-xl bg-sabrar-950/80 border border-sabrar-500/30 flex items-center justify-center text-sabrar-400 shrink-0">
                      <Building className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h3 className="font-extrabold text-sm text-white group-hover:text-sabrar-400 transition-colors truncate">
                        {c.name}
                      </h3>
                      {c.corporate_name && (
                        <p className="text-[10px] text-slate-400 truncate">{c.corporate_name}</p>
                      )}
                    </div>
                  </div>

                  {c.is_recurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 shrink-0">
                      Recorrente
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-dark-750">
                  {c.cnpj_cpf && (
                    <div className="text-[11px] text-slate-400 font-mono">
                      CNPJ/CPF: <span className="text-slate-300">{c.cnpj_cpf}</span>
                    </div>
                  )}
                  {c.contact_person && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.contact_person}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.city && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.city} - {c.state || 'RJ'}</span>
                    </div>
                  )}
                  {c.segment && (
                    <div className="text-[10px] text-sabrar-400 font-semibold mt-1">
                      Segmento: {c.segment}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-dark-750 text-xs">
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('projects')}
                    className="text-sabrar-400 hover:text-sabrar-300 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <span>Ver Obras</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(c)}
                    className="p-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border border-dark-700 transition-colors"
                    title="Editar Cliente"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClient(c)}
                    className="p-1.5 rounded-lg bg-dark-850 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-dark-700 transition-colors"
                    title="Excluir Cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
            <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-white">
                    {editingClient ? 'Editar Cliente' : 'Novo Cliente Recorrente'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Preencha os dados cadastrais para salvar na base oficial da SABRAR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">
                    Nome / Razão Fantasia do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Smart Supermercado, KIK Calçados, Multiplan"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Razão Social Completa
                  </label>
                  <input
                    type="text"
                    value={corporateName}
                    onChange={(e) => setCorporateName(e.target.value)}
                    placeholder="Ex: Comercial Supermercados Ltda"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    CNPJ ou CPF
                  </label>
                  <input
                    type="text"
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Pessoa de Contato / Gestor
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Ex: Roberto Alcantara"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(21) 99999-9999"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">
                    E-mail do Cliente
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">
                    Endereço / Sede
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número, bairro..."
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Rio de Janeiro"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estado</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="RJ"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Segmento de Atuação</label>
                  <input
                    type="text"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    placeholder="Ex: Varejo, Supermercado, Shopping, Hospitalar, Predial"
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isRecurrent"
                    checked={isRecurrent}
                    onChange={(e) => setIsRecurrent(e.target.checked)}
                    className="w-4 h-4 rounded text-sabrar-600 bg-dark-850 border-dark-700 focus:ring-sabrar-500"
                  />
                  <label htmlFor="isRecurrent" className="text-slate-300 font-bold cursor-pointer">
                    Cliente Recorrente da SABRAR (Demanda contínua de orçamentos e obras)
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Observações Comerciais</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Condições comerciais especiais, regras de faturamento, prazos..."
                    className="w-full p-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
