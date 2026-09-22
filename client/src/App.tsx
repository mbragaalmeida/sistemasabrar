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

import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { StockPage } from './pages/StockPage';
import { RequestsPage } from './pages/RequestsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { AILearningHub } from './pages/AILearningHub';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LoginPage } from './pages/LoginPage';
import { api } from './services/api';
import { isPageAllowed } from './utils/permissions';

const AppContent: React.FC = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <LoginPage />;
  }

  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Modais de Ação Rápida
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isQuickEntryModalOpen, setIsQuickEntryModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);

  // Redireciona para o Dashboard caso o usuário troque para um perfil sem permissão na página aberta
  useEffect(() => {
    const role = currentUser?.role || 'admin';
    if (!isPageAllowed(currentPage, role)) {
      setCurrentPage('dashboard');
    }
  }, [currentUser]);

  // Carrega contagem de notificações não lidas
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.getNotifications(undefined, currentUser?.id);
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
      setCurrentPage('dashboard');
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
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col selection:bg-sabrar-600 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onToggleSidebar={() => setIsSidebarMobileOpen(true)}
        unreadNotificationsCount={unreadCount}
      />

      <div className="flex-1 flex w-full">
        {/* Sidebar (Desktop persistent + Mobile slide-over) */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isOpenMobile={isSidebarMobileOpen}
          onCloseMobile={() => setIsSidebarMobileOpen(false)}
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
            <NotificationsPage />
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
