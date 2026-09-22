# Guia Oficial de Implantação e Produção — Sistema SABRAR

Este documento detalha o passo a passo para colocar o **Sistema SABRAR** em produção com hospedagem no **GitHub** e **Vercel**, além das instruções para a API Node.js e banco SQLite.

---

## 1. Credenciais do Usuário Mestre (Acesso Real)

O banco de dados de produção foi inicializado limpo (zero-state) com a conta mestre administrativa:

- **Nome:** Matheus Braga
- **E-mail:** `mbragaalmeida@gmail.com`
- **Senha:** `Ma191095.`
- **Perfil:** Administrador Geral (Acesso irrestrito a todos os módulos, aprovações e auditoria)

> **Nota:** A tela de login possui autenticação segura via e-mail e senha, com sessão persistente via JWT.

---

## 2. Envio do Código para o GitHub

No terminal (na pasta raiz do projeto `Sistema Sabrar`):

```bash
# 1. Inicialize o repositório git (caso ainda não tenha feito)
git init

# 2. Adicione todos os arquivos
git add .

# 3. Crie o primeiro commit de produção
git commit -m "feat: release produção Sistema SABRAR v1.0.0 com login, calibração por documentos e leitor NF-e"

# 4. Crie o repositório no seu GitHub (ex: https://github.com/SEU-USUARIO/sistema-sabrar)

# 5. Conecte ao seu repositório remoto e envie
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/sistema-sabrar.git
git push -u origin main
```

---

## 3. Hospedagem do Frontend na Vercel

A Vercel é a plataforma recomendada para hospedar a aplicação React/Vite com CDN global de altíssima velocidade.

### Passo a Passo no Painel da Vercel:

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub.
2. Clique em **"Add New..."** → **"Project"**.
3. Importe o repositório `sistema-sabrar` que você subiu no GitHub.
4. Na tela de configuração de build:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./client` (ou mantenha `./` pois os arquivos `vercel.json` já foram pré-configurados).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Em **Environment Variables (Variáveis de Ambiente)**:
   - Adicione a variável:
     - **Name:** `VITE_API_URL`
     - **Value:** URL pública da sua API backend (ex: `https://api-sabrar.onrender.com` ou `https://sua-api.up.railway.app`).
     *(Se o backend estiver hospedado no mesmo domínio ou via proxy, o frontend usará `/api` automaticamente).*
6. Clique em **"Deploy"**.
7. Pronto! A sua aplicação estará disponível no endereço gerado pela Vercel (ex: `https://sistema-sabrar.vercel.app`).

---

## 4. Hospedagem do Backend Node.js & Banco SQLite

O backend do Sistema SABRAR é uma API Node.js Express de alta performance com banco SQLite (modo WAL).

Para que os dados cadastrados (materiais, notas fiscais, orçamentos, estoque e calibrações de IA) fiquem salvos permanentemente:

### Opção A: Render.com (Recomendado - Gratuito/Simples)
1. Acesse [render.com](https://render.com) e crie um **"Web Service"** conectado ao mesmo repositório do GitHub.
2. Configurações:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - Adicione um **Persistent Disk** montado em `/server/data` para persistir o arquivo `sabrar.db`.
3. Copie a URL gerada (ex: `https://sabrar-api.onrender.com`) e insira na variável `VITE_API_URL` na Vercel!

### Opção B: Railway.app (1 Clique)
1. Crie um projeto no [railway.app](https://railway.app) a partir do repositório.
2. Adicione um volume de disco na pasta `server/data`.
3. Start command: `node server/src/index.js`.

### Opção C: Servidor VPS Próprio (Ubuntu com Docker ou PM2)
1. Clone o repositório no servidor:
   ```bash
   git clone https://github.com/SEU-USUARIO/sistema-sabrar.git
   cd sistema-sabrar
   npm install
   npm run build
   pm2 start server/src/index.js --name "sabrar-server"
   ```
2. Configure o Nginx para apontar para a porta 3001.

---

## 5. Principais Recursos de Produção Prontos para Uso

1. **Tela de Autenticação & Login:**
   - Proteção de rotas e persistência de sessão no navegador.
   - Botão de logout no menu lateral e cabeçalho.
2. **Entrada de Materiais via NF-e (Leitor XML):**
   - Na página de **Materiais**, clique em **"Entrada via NF-e (XML)"**.
   - O sistema lê a nota fiscal oficial da SEFAZ, importa os produtos, converte as unidades de medida (kg para metros/m² quando aplicável) e **atualiza o preço de referência da base para o valor unitário da última compra real**.
3. **Calibração Contínua da IA por Documentos Técnicos:**
   - No **Hub de Aprendizado IA**, envie plantas e memoriais em PDF e/ou planilhas de medição/consumo real em XLSX.
   - A IA agrupa os arquivos por obra, calcula os fatores de calibração empírica e refina os orçamentos futuros sem alterar os históricos passados.
4. **Modo Duplo de Levantamento AVAC (HVAC):**
   - **Modo A:** Levantamento direto quando houver projetos executivos de climatização.
   - **Modo B:** Engenharia reversa técnica calculando carga térmica (BTU/h e TR) segundo NBR 16401 e ASHRAE 90.1 quando houver apenas arquitetura.
