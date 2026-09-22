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

### Status do Supabase: 100% Configurado e Ativo!
Nós já nos conectamos ao seu banco de dados Supabase e executamos a inicialização completa de todas as 20 tabelas e dos usuários (com o seu usuário mestre Matheus Braga cadastrado como Administrador Geral). **Você não precisa rodar nenhum comando no SQL Editor — o banco já está pronto!**

### String Oficial de Conexão (Pooler IPv4 Pronto para a Vercel)
A sua string oficial, com a região exata do seu projeto (`us-west-2`) e os caracteres especiais da senha (`@`) devidamente codificados (`%40`), é:

```text
postgresql://postgres.uubxdjhvzrzlgxgcqfoh:Sistem%40s%40br%40r2026@aws-0-us-west-2.pooler.supabase.com:6543/postgres
```

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
