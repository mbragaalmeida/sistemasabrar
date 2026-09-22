import React, { useState, useEffect } from 'react';
import { UserPlus, X, AlertCircle, Check, Shield, Mail, Lock, User as UserIcon } from 'lucide-react';
import { api } from '../../services/api';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(3); // Default: Engenharia
  const [department, setDepartment] = useState('Obras & Operações');
  const [phone, setPhone] = useState('');

  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getRoles()
        .then((data) => {
          setRoles(data);
          if (data.length > 0 && !roleId) {
            setRoleId(data[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Atualiza sugestão de departamento ao trocar o perfil
  const handleRoleChange = (newRoleId: number) => {
    setRoleId(newRoleId);
    switch (newRoleId) {
      case 1:
        setDepartment('Diretoria Executiva');
        break;
      case 2:
        setDepartment('Engenharia de Custos');
        break;
      case 3:
        setDepartment('Obras & Operações');
        break;
      case 4:
        setDepartment('Logística & Almoxarifado');
        break;
      case 5:
        setDepartment('Suprimentos & Compras');
        break;
      default:
        break;
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Por favor, informe o nome completo do usuário.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (!password || password.length < 3) {
      setError('A senha deve conter no mínimo 3 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await api.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role_id: Number(roleId),
        department: department.trim(),
        phone: phone.trim()
      });

      // Limpa formulário e fecha
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar usuário:', err);
      setError(err.message || 'Falha ao cadastrar o usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp">
        {/* Cabeçalho do Modal */}
        <div className="p-5 bg-dark-850 border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Criar Novo Usuário</h2>
              <p className="text-xs text-slate-400">Cadastre credenciais e determine a permissão de acesso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Nome Completo */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Nome Completo <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ana Paula Martins"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>
          </div>

          {/* E-mail e Senha em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                E-mail de Acesso <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@sabrar.com.br"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Senha Inicial <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>
            </div>
          </div>

          {/* Perfil / Função */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Perfil & Permissão de Acesso <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={roleId}
                onChange={(e) => handleRoleChange(Number(e.target.value))}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 appearance-none font-medium cursor-pointer"
              >
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <option key={r.id} value={r.id} className="bg-dark-900 text-white">
                      {r.label} ({r.name})
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1} className="bg-dark-900">Administrador</option>
                    <option value={2} className="bg-dark-900">Setor de orçamento</option>
                    <option value={3} className="bg-dark-900">Engenharia</option>
                    <option value={4} className="bg-dark-900">Almoxarifado</option>
                    <option value={5} className="bg-dark-900">Compras</option>
                  </>
                )}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Determina quais abas e recursos do sistema estarão visíveis e acessíveis para este usuário.
            </p>
          </div>

          {/* Ações */}
          <div className="pt-3 border-t border-dark-750 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-dark-700 text-slate-300 hover:text-white hover:bg-dark-800 transition-colors font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Cadastrar Usuário</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
