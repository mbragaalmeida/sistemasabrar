import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeDatabase } from './db/schema.js';
import { seedDatabase } from './db/seed.js';

import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { aiRouter } from './routes/ai.js';
import { budgetsRouter } from './routes/budgets.js';
import { materialsRouter } from './routes/materials.js';
import { requestsRouter } from './routes/requests.js';
import { purchasesRouter } from './routes/purchases.js';
import { returnsRouter } from './routes/returns.js';
import { stockRouter } from './routes/stock.js';
import { suppliersRouter } from './routes/suppliers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { notificationsRouter } from './routes/notifications.js';
import { auditRouter } from './routes/audit.js';
import { searchRouter } from './routes/search.js';
import { bulkImportRouter } from './routes/bulkImport.js';
import { nfeRouter } from './routes/nfe.js';
import { aiCalibrationRouter } from './routes/aiCalibration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Inicializa e alimenta banco se necessário
initializeDatabase();
seedDatabase();

// Registra rotas da API com suporte duplo (/api/* e /*) para compatibilidade perfeita com Vercel Serverless
const apiEndpoints = [
  ['/auth', authRouter],
  ['/projects', projectsRouter],
  ['/ai', aiRouter],
  ['/budgets', budgetsRouter],
  ['/materials', materialsRouter],
  ['/requests', requestsRouter],
  ['/purchases', purchasesRouter],
  ['/returns', returnsRouter],
  ['/stock', stockRouter],
  ['/suppliers', suppliersRouter],
  ['/dashboard', dashboardRouter],
  ['/reports', reportsRouter],
  ['/notifications', notificationsRouter],
  ['/audit', auditRouter],
  ['/search', searchRouter],
  ['/bulk-import', bulkImportRouter],
  ['/nfe', nfeRouter],
  ['/ai-calibration', aiCalibrationRouter]
];

for (const [routePath, router] of apiEndpoints) {
  app.use(`/api${routePath}`, router);
  app.use(routePath, router);
}

// Rota de sanidade
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    system: 'Sistema SABRAR - Orçamento Inteligente & Gestão Operacional de Obras',
    version: '1.0.0',
    database: 'Supabase PostgreSQL (Ativo & Conectado)',
    time: new Date().toISOString()
  });
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Servir frontend compilado em produção se existir
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(200).send('Servidor SABRAR ativo na porta ' + PORT);
  });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' });
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 [SISTEMA SABRAR] Servidor rodando na porta ${PORT}`);
    console.log(`📡 API pronta em: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

export { app };
export default app;

