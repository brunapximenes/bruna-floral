# 🌸 Bruna Floral — Portal de Eventos

Portal para questionários de decoração floral, gestão de eventos e geração de orçamentos.

---

## Estrutura do projeto

```
bruna-floral/
├── index.html          ← Landing page (página inicial)
├── questionario.html   ← Formulário público para clientes
├── painel.html         ← Painel exclusivo da Bruna
├── css/style.css       ← Estilos compartilhados
├── js/                 ← Lógica em JavaScript
├── assets/logo.png     ← Logo da Bruna Floral
├── api/                ← Funções do servidor (Google Sheets)
├── schema.sql          ← Schema do banco de dados (Supabase)
└── vercel.json         ← Configuração de rotas
```

---

## Configuração inicial

### 1. Supabase (banco de dados)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. No menu lateral, clique em **SQL Editor**
3. Cole e execute o conteúdo do arquivo `schema.sql`
4. Vá em **Settings > API** e anote:
   - **Project URL** (ex: `https://xyzxyz.supabase.co`)
   - **anon public key** (começa com `eyJ...`)
   - **service_role key** (para o servidor — nunca use no frontend!)
5. Crie a senha da Bruna: **Authentication > Users > Invite user**

### 2. Configurar chaves no projeto

Abra o arquivo `js/config.js` e preencha:
```js
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...SUA-CHAVE-ANON...';
```

### 3. Vercel (hospedagem)

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **New Project** → importe o repositório `bruna-floral`
3. Vá em **Settings > Environment Variables** e adicione:
   - `SUPABASE_URL` = URL do projeto
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key (NÃO é a anon key)
   - `GOOGLE_SERVICE_ACCOUNT` = JSON da service account (ver abaixo)
   - `GOOGLE_SHEET_ID` = ID da planilha Google
4. Clique em **Deploy**

### 4. Google Sheets (exportação)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto → habilite a **Google Sheets API**
3. Crie uma **Service Account** → baixe o JSON de credenciais
4. Crie uma planilha no Google Sheets chamada `Bruna Floral — Eventos`
5. Compartilhe a planilha com o email da service account (ex: `bruna-floral@projeto.iam.gserviceaccount.com`)
6. Copie o ID da planilha da URL (o código entre `/d/` e `/edit`)

---

## Como usar

### Para a Bruna
- **Painel**: acesse `/painel` → login com email e senha
- **Novo evento**: botão "+ Novo evento" no canto superior
- **Status**: selecione o status no topo de cada evento
- **Orçamento**: aba "Orçamento" → adicione itens, calcule totais
- **Controle interno**: aba "Controle interno" → adicione custos e equipe
- **PDF**: botão "Gerar PDF do orçamento" na aba Orçamento
- **Sheets**: botão "Exportar para Google Sheets"

### Para os clientes
- Acesse `/questionario` → preencha o formulário → clique "Enviar"
- Um WhatsApp abre com as informações para enviar à Bruna
- Uma tela de confirmação é exibida

---

## Logo

Coloque o arquivo da logo em `assets/logo.png`.
Tamanho recomendado: mínimo 200x200px, fundo transparente (PNG).

---

## Suporte

Em caso de dúvidas técnicas, abra uma conversa no Claude Code.
