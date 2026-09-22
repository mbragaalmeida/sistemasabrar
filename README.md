# SISTEMA SABRAR — Plataforma Inteligente de Orçamento, Gestão de Materiais e Execução de Obras

O **Sistema SABRAR** é uma aplicação web completa, moderna e responsiva concebida com abordagem **Mobile First**, desenvolvida especificamente para a construtora SABRAR.

A aplicação unifica o ciclo completo da construção civil:
$$\text{Projeto} \longrightarrow \text{Orçamento (IA)} \longrightarrow \text{Aprovação} \longrightarrow \text{Execução} \longrightarrow \text{Solicitações} \longrightarrow \text{Estoque/Almoxarifado} \longrightarrow \text{Compras} \longrightarrow \text{Consumo Real} \longrightarrow \text{Aprendizado da IA}$$

---

## 🌟 Diferenciais e Tecnologias

- **Abordagem Mobile First**: Prioridade total para experiência em smartphones (cards inteligentes, botões com área de toque confortável $\ge 44\text{px}$, barra de navegação inferior permanente, gaveta recolhível e modais responsivos) com adaptação nativa para tablets e desktops.
- **AI Analysis Service com Explicabilidade**: Motor de IA que interpreta memoriais descritivos e projetos técnicos, identifica especificações de materiais, cruza com o catálogo da SABRAR e justifica tecnicamente cada quantidade estimada.
- **Motor de Aprendizado Contínuo (Regras 24 a 29)**: As decisões de revisão humana e os resultados de consumo real das obras anteriores retroalimentam a base de inteligência para calibrar estimativas futuras sem alterar retrospectivamente dados antigos (imutabilidade para auditoria).
- **Controle de Estoque em 3 Níveis**:
  $$\text{Estoque Disponível} = \text{Estoque Físico} - \text{Estoque Reservado}$$
- **Detecção Automática de Déficit**: Ao solicitar materiais, se $\text{Disponível} < \text{Solicitado}$, o sistema reserva o saldo existente e gera automaticamente uma Demanda de Compra para o setor de suprimentos.
- **Cálculo Rigoroso de Consumo Real**:
  $$\text{Consumo Real} = \text{Quantidade Retirada} - \text{Quantidade Devolvida}$$
- **Análise Previsto × Realizado com Variação**: Tabela comparativa e indicadores percentuais de desvio ($+X\%$ acima / $-Y\%$ economia).
- **Banco de Dados Relacional Nativo**: SQLite nativo (`node:sqlite`) embutido no Node.js 24, com alta performance, transações síncronas, chaves estrangeiras e integridade referencial.
- **Alternador Rápido de Perfis**: Seletor no topo da aplicação para alternar em 1 clique entre os 5 perfis de usuário para simulação de todos os fluxos.

---

## 👥 Perfis de Acesso

1. **Administrador** (`admin@sabrar.com.br`): Acesso irrestrito a todos os módulos, usuários, configurações e logs de auditoria.
2. **Setor de Orçamento** (`orcamento@sabrar.com.br`): Recebe sugestões da IA, altera quantidades/preços, adiciona mão de obra e serviços, gera proposta comercial em formato de impressão/PDF.
3. **Engenharia** (`engenharia@sabrar.com.br`): Acompanha obras aprovadas e emite solicitações de materiais com prioridade e diagnóstico em tempo real.
4. **Almoxarifado** (`almoxarifado@sabrar.com.br`): Separa materiais (`Em separação` $\rightarrow$ `Separado` $\rightarrow$ `Entregue`), registra devoluções reutilizáveis e confere entradas.
5. **Compras** (`compras@sabrar.com.br`): Gerencia demandas automáticas originadas de déficits, registra cotações, emite pedidos e confirma recebimento no estoque físico.

---

## 🚀 Como Executar o Sistema

### Pré-requisitos
- Node.js versão 22.5 ou superior (testado na v24.18.0)

### 1. Iniciar o Sistema Completo (Servidor + Frontend Integrado)
```bash
npm start
```
Acesse a aplicação no navegador em:
**http://localhost:3001**

### 2. Modo Desenvolvimento com Hot-Reload (Vite + Express)
Para editar o frontend em tempo real com Vite:
```bash
# Terminal 1: Backend Express API
npm run server

# Terminal 2: Frontend Vite com proxy
npm run client
```
Acesse o ambiente de desenvolvimento em: **http://localhost:5173**

---

## 📂 Estrutura do Projeto

```
sistema-sabrar/
├── package.json
├── server/
│   ├── data/sabrar.db            # Banco de dados SQLite persistente
│   └── src/
│       ├── index.js              # Servidor Express e roteamento
│       ├── db/
│       │   ├── connection.js     # Conexão nativa node:sqlite
│       │   ├── schema.js         # Criação das 20+ tabelas e índices
│       │   └── seed.js           # Carga inicial com dados realistas da SABRAR
│       ├── services/
│       │   ├── aiService.js       # AI Analysis Service com explicabilidade
│       │   ├── learningService.js # Motor de Aprendizado Contínuo
│       │   └── stockService.js    # Regras de estoque, reserva, déficit e devoluções
│       └── routes/               # Rotas REST completas de todos os módulos
└── client/
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── context/AuthContext.tsx # Gerenciamento de perfil e login
        ├── components/
        │   ├── layout/            # Header, Sidebar gaveta e BottomNav mobile
        │   ├── common/            # StatusBadge, Busca Global e Notificações
        │   ├── ai/                # Modal de IA e Hub de Aprendizado
        │   ├── budget/            # Proposta comercial para o cliente
        │   └── modals/            # Entrada rápida, Nova solicitação, Devolução
        └── pages/                 # Telas de todos os 11 módulos do sistema
```

---

## 🔄 Fluxos Operacionais Verificados

1. **Orçamento Inteligente**:
   - Cadastro de projeto com texto de memorial descritivo.
   - Disparo da análise por IA $\rightarrow$ Extração de itens com justificativa técnica.
   - Revisão humana: ajuste de quantidades/preços e inclusão de mão de obra.
   - Emissão de Proposta Comercial profissional (com visualização de impressão/PDF).
   - Aprovação do orçamento $\rightarrow$ Projeto entra em status `Em execução`.
2. **Solicitação com Déficit Automático**:
   - Engenharia solicita material com quantidade acima do estoque disponível.
   - O sistema reserva o estoque disponível e gera instantaneamente uma demanda de compra no Módulo de Compras.
3. **Recebimento e Baixa de Estoque**:
   - Compras/Almoxarifado confirma recebimento $\rightarrow$ Estoque físico é incrementado.
   - Almoxarifado separa itens e confirma entrega $\rightarrow$ Baixa no estoque físico e reservado.
4. **Devolução e Consumo Real**:
   - Almoxarifado registra sobras reutilizáveis $\rightarrow$ Incrementa estoque físico e atualiza:
     $$\text{Consumo Real} = \text{Retirado} - \text{Devolvido}$$
5. **Auditoria e Aprendizado Contínuo**:
   - Todo histórico permanece imutável para auditoria técnica e contábil.
   - Os desvios calibram futuros orçamentos da mesma tipologia de obra.
