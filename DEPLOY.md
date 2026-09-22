# Guia Oficial de Implantação e Produção — Sistema SABRAR
## Arquitetura Oficial: Vercel (Frontend & API) + Supabase (PostgreSQL) + GitHub

Este documento detalha o passo a passo para colocar o **Sistema SABRAR** em produção com hospedagem no **GitHub**, **Vercel** e banco de dados **Supabase (PostgreSQL)**.

---

## 1. Credenciais do Usuário Mestre (Acesso Real)

O banco de dados de produção foi estruturado com o usuário mestre administrativo:

- **Nome:** Matheus Braga
- **E-mail:** `mbragaalmeida@gmail.com`
- **Senha:** `Ma191095.`
- **Perfil:** Administrador Geral (Acesso irrestrito a todos os módulos, aprovações e auditoria)

---

## 2. Repositório no GitHub

O repositório já está conectado e sincronizado com a sua conta do GitHub:

- **Repositório:** [https://github.com/mbragaalmeida/sistemasabrar](https://github.com/mbragaalmeida/sistemasabrar)
- **Branch principal:** `main`

Para enviar futuras alterações locais para o GitHub, basta rodar:
```bash
git add .
git commit -m "sua mensagem"
git push origin main
```

---

## 3. Configuração do Banco de Dados no Supabase

Você já criou o projeto no Supabase (`uubxdjhvzrzlgxgcqfoh`). Siga os dois passos abaixo:

### Passo A: Criar as Tabelas e Carga Inicial (1 Clique)
1. Acesse o painel do seu projeto no Supabase: [supabase.com/dashboard](https://supabase.com/dashboard).
2. No menu lateral esquerdo, clique no ícone **SQL Editor**.
3. Clique em **"New query"**.
4. Abra o arquivo [`supabase_schema.sql`](./supabase_schema.sql) presente na raiz deste projeto, copie todo o conteúdo e cole dentro do editor.
5. Clique no botão verde **"Run"** (ou pressione `Ctrl + Enter`).
6. Pronto! Todas as 20 tabelas, índices de alta performance e a conta do **Matheus Braga** estarão criadas e prontas.

### Passo B: Obter a Connection String do Pooler (Para a Vercel)
No Supabase:
1. Clique em **Project Settings** (ícone de engrenagem no menu inferior esquerdo).
2. Vá em **Database**.
3. Role até a seção **Connection string** e clique na aba **Transaction Pooler** (Porta `6543`).
   *(O Pooler é necessário porque a Vercel opera em IPv4 e gerencia múltiplas conexões sem sobrecarregar o banco).*
4. Copie a string. Ela terá o seguinte formato:
   ```
   postgresql://postgres.uubxdjhvzrzlgxgcqfoh:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
   *(Substitua `[SUA-SENHA]` pela senha que você definiu ao criar o projeto no Supabase).*

---

## 4. Implantação na Vercel (1 Clique)

A Vercel hospedará tanto o **Frontend React/Vite** quanto as **Rotas de API Node.js** com CDN global e HTTPS automático.

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique em **"Add New..."** → **"Project"**.
3. Localize o repositório **`sistemasabrar`** e clique em **"Import"**.
4. Na tela de configuração:
   - **Framework Preset:** `Vite` (reconhecido automaticamente)
   - **Root Directory:** `./`
   - O arquivo `vercel.json` na raiz já cuidará de compilar o `client/dist` e rotear `/api/*` para a API Serverless.
5. Em **Environment Variables**:
   - Adicione a variável:
     - **Name:** `DATABASE_URL`
     - **Value:** Cole a string do Supabase Transaction Pooler com a sua senha.
   - *(Opcional)* Adicione:
     - **Name:** `JWT_SECRET`
     - **Value:** `sabrar-seguranca-producao-2026`
6. Clique em **"Deploy"**!
7. Em menos de 2 minutos, sua aplicação estará no ar com URL pública oficial (ex: `https://sistemasabrar.vercel.app`).
