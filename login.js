document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const alertBox = document.getElementById('auth-alert');
    const selectRole = document.getElementById('reg-role');
    const groupAdminCode = document.getElementById('group-admin-code');

    const BASE_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? 'http://localhost:3000/api'
        : 'https://pfc-stackoverflowai.onrender.com/api';

    // Alternar Abas (Entrar vs Criar Conta)
    tabLogin.addEventListener('click', () => {
        tabLogin.style.color = 'var(--accent-color)';
        tabLogin.style.borderBottom = '2px solid var(--accent-color)';
        tabRegister.style.color = 'var(--text-secondary)';
        tabRegister.style.borderBottom = 'none';
        formLogin.style.display = 'flex';
        formRegister.style.display = 'none';
        esconderAlerta();
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.style.color = 'var(--bot-color)';
        tabRegister.style.borderBottom = '2px solid var(--bot-color)';
        tabLogin.style.color = 'var(--text-secondary)';
        tabLogin.style.borderBottom = 'none';
        formRegister.style.display = 'flex';
        formLogin.style.display = 'none';
        esconderAlerta();
    });

    // Exibir campo de chave se escolher "Administrador"
    if (selectRole) {
        selectRole.addEventListener('change', () => {
            if (selectRole.value === 'admin') {
                groupAdminCode.style.display = 'flex';
            } else {
                groupAdminCode.style.display = 'none';
            }
        });
    }

    function mostrarAlerta(msg, tipo = 'erro') {
        alertBox.style.display = 'block';
        if (tipo === 'sucesso') {
            alertBox.style.background = 'rgba(74, 222, 128, 0.15)';
            alertBox.style.border = '1px solid rgba(74, 222, 128, 0.4)';
            alertBox.style.color = '#4ade80';
        } else {
            alertBox.style.background = 'rgba(244, 63, 94, 0.15)';
            alertBox.style.border = '1px solid rgba(244, 63, 94, 0.4)';
            alertBox.style.color = '#f43f5e';
        }
        alertBox.innerText = msg;
    }

    function esconderAlerta() {
        alertBox.style.display = 'none';
    }

    // 1. SUBMISSÃO DE LOGIN
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        esconderAlerta();

        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-password').value;
        const btn = formLogin.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Autenticando no MongoDB...';

        try {
            const res = await fetch(`${BASE_API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta("✅ Login realizado com sucesso! Redirecionando...", "sucesso");
                
                // Salva a sessão autenticada no navegador
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('userName', data.user.nome);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userRole', data.user.role); // 'aluno' ou 'admin'

                setTimeout(() => { window.location.href = 'index.html'; }, 800);
            } else {
                mostrarAlerta(data.error || "Falha ao realizar login.");
                btn.disabled = false;
                btn.innerHTML = '<span>Entrar no Sistema</span> <i class="fas fa-arrow-right"></i>';
            }
        } catch (err) {
            mostrarAlerta("Erro de conexão com o servidor.");
            btn.disabled = false;
            btn.innerHTML = '<span>Entrar no Sistema</span> <i class="fas fa-arrow-right"></i>';
        }
    });

    // 2. SUBMISSÃO DE CADASTRO (CRIAR CONTA)
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        esconderAlerta();

        const nome = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const senha = document.getElementById('reg-password').value;
        const role = selectRole.value;
        const adminCode = document.getElementById('reg-admin-code').value.trim();
        const btn = formRegister.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Criando conta no MongoDB...';

        try {
            const res = await fetch(`${BASE_API}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha, role, adminCode })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta("🎉 Conta criada com sucesso! Redirecionando...", "sucesso");
                
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('userName', data.user.nome);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userRole', data.user.role);

                setTimeout(() => { window.location.href = 'index.html'; }, 900);
            } else {
                mostrarAlerta(data.error || "Não foi possível criar a conta.");
                btn.disabled = false;
                btn.innerHTML = '<span>Finalizar Cadastro</span> <i class="fas fa-user-plus"></i>';
            }
        } catch (err) {
            mostrarAlerta("Erro de conexão ao cadastrar.");
            btn.disabled = false;
            btn.innerHTML = '<span>Finalizar Cadastro</span> <i class="fas fa-user-plus"></i>';
        }
    });
});