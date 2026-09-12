/* ============================================================
   painel-auth.js — Login e sessão via Supabase Auth
   ============================================================ */

async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    mostrarApp();
  }
}

async function entrar() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erro  = document.getElementById('login-erro');
  const btn   = document.getElementById('btn-entrar');

  if (!email || !senha) {
    erro.textContent = 'Preencha e-mail e senha.';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Entrando...';
  erro.textContent = '';

  const { error } = await sb.auth.signInWithPassword({ email, password: senha });

  btn.disabled = false;
  btn.textContent = 'Entrar';

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const credenciais = error.status === 400 || msg.includes('invalid login') || msg.includes('credential');
    erro.textContent = credenciais
      ? 'E-mail ou senha incorretos. Tente novamente.'
      : 'Não foi possível conectar ao sistema agora (o servidor pode estar reativando). Aguarde 1–2 min e tente de novo.';
    return;
  }

  mostrarApp();
}

async function sair() {
  await sb.auth.signOut();
  location.reload();
}

function mostrarApp() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-app').style.display   = 'block';
  carregarLista();
}
