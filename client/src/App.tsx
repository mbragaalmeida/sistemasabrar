import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { QuickEntryModal } from './components/modals/QuickEntryModal';
import { NewRequestModal } from './components/modals/NewRequestModal';
import { ChangePasswordModal } from './components/modals/ChangePasswordModal';

import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { DuctsPage } from './pages/DuctsPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { StockPage } from './pages/StockPage';
import { RequestsPage } from './pages/RequestsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { PurchasesStockDashboardPage } from './pages/PurchasesStockDashboardPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { LogisticsPage } from './pages/LogisticsPage';
import { AILearningHub } from './pages/AILearningHub';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LoginPage } from './pages/LoginPage';
import { api } from './services/api';
import { isPageAllowed, getDefaultPageForRole } from './utils/permissions';

const AppContent: React.FC = () => {
  const { currentUser, isSimulating, stopSimulation } = useAuth();

  if (!currentUser) {
    return <LoginPage />;
  }

  const [currentPage, setCurrentPage] = useState<string>(() => getDefaultPageForRole(currentUser?.role));
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Modais de Ação Rápida
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isQuickEntryModalOpen, setIsQuickEntryModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Redireciona para a página padrão do perfil caso o usuário troque para um perfil sem permissão na página aberta
  useEffect(() => {
    const role = currentUser?.role || 'admin';
    if (!isPageAllowed(currentPage, role)) {
      setCurrentPage(getDefaultPageForRole(role));
    }
  }, [currentUser, currentPage]);

  // Carrega contagem de notificações não lidas
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.getNotifications(currentUser?.role, currentUser?.id);
        setUnreadCount(res.unreadCount || 0);
      } catch (err) {
        // Silencioso se inicializando
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // Polling a cada 15s
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleNavigate = (page: string, id?: number) => {
    const role = currentUser?.role || 'admin';
    if (!isPageAllowed(page, role)) {
      setCurrentPage(getDefaultPageForRole(role));
      return;
    }

    if (page === 'project-detail' && id) {
      setSelectedProjectId(id);
      setCurrentPage('project-detail');
    } else {
      setCurrentPage(page);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-sabrar-600 selection:text-white w-full max-w-full">
      {/* Top Header */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onToggleSidebar={() => setIsSidebarMobileOpen(true)}
        onNavigate={handleNavigate}
        unreadNotificationsCount={unreadCount}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
      />

      {/* Banner de Aviso de Simulação Administrativa */}
      {isSimulating && (
        <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-amber-500/40 text-amber-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg sticky top-[57px] z-30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-extrabold text-white uppercase tracking-wider">Modo de Simulação Setorial:</span>
            <span>Visualizando a plataforma com as permissões restritas do <strong>{currentUser?.role_label}</strong>.</span>
          </div>
          <button
            onClick={stopSimulation}
            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl text-xs transition-transform active:scale-95 shadow-sm"
          >
            Encerrar Simulação & Voltar ao Admin
          </button>
        </div>
      )}

      <div className="flex-1 flex w-full min-w-0">
        {/* Sidebar (Desktop persistent + Mobile slide-over) */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isOpenMobile={isSidebarMobileOpen}
          onCloseMobile={() => setIsSidebarMobileOpen(false)}
          onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        />

        {/* Main Content Area (Mobile First Responsive) */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 pb-24 md:pb-12">
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={handleNavigate}
              onOpenNewProject={() => setIsNewProjectModalOpen(true)}
              onOpenQuickEntry={() => setIsQuickEntryModalOpen(true)}
              onOpenNewRequest={() => setIsNewRequestModalOpen(true)}
            />
          )}

          {currentPage === 'projects' && (
            <ProjectsPage
              onNavigate={handleNavigate}
              onOpenNewProject={() => setIsNewProjectModalOpen(true)}
            />
          )}

          {currentPage === 'project-detail' && selectedProjectId && (
            <ProjectDetailPage
              projectId={selectedProjectId}
              onBack={() => setCurrentPage('projects')}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'budgets' && (
            <BudgetsPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'ducts' && (
            <DuctsPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'materials' && (
            <MaterialsPage />
          )}

          {currentPage === 'stock' && (
            <StockPage />
          )}

          {currentPage === 'requests' && (
            <RequestsPage />
          )}

          {currentPage === 'purchases' && (
            <PurchasesPage />
          )}

          {currentPage === 'logistics' && (
            <LogisticsPage />
          )}

          {currentPage === 'bi-purchases-stock' && (
            <PurchasesStockDashboardPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'suppliers' && (
            <SuppliersPage />
          )}

          {currentPage === 'ai-hub' && (
            <AILearningHub />
          )}

          {currentPage === 'reports' && (
            <ReportsPage />
          )}

          {currentPage === 'audit' && (
            <AuditPage />
          )}

          {currentPage === 'users' && (
            <UsersPage />
          )}

          {currentPage === 'notifications' && (
            <NotificationsPage onNavigate={handleNavigate} />
          )}
        </main>
      </div>

      {/* Mobile-First Sticky Bottom Navigation Bar */}
      <BottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenSidebar={() => setIsSidebarMobileOpen(true)}
      />

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigate={handleNavigate}
        onUpdateCount={(cnt) => setUnreadCount(cnt)}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onSuccess={(id) => handleNavigate('project-detail', id)}
      />

      <QuickEntryModal
        isOpen={isQuickEntryModalOpen}
        onClose={() => setIsQuickEntryModalOpen(false)}
        onSuccess={() => {
          // Recarrega dados onde relevante
        }}
      />

      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSuccess={() => handleNavigate('requests')}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};
export default App;
