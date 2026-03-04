document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    const askButton = document.getElementById('ask-button');
    if (askButton) {
        askButton.addEventListener('click', (e) => {
            e.preventDefault();
            // Bloqueio condicional: Se logado, vai para a tela ask. Senão, login!
            if (isLoggedIn) {
                window.location.href = 'ask.html';
            } else {
                window.location.href = 'login.html';
            }
        });
    }
});

function renderizarPerfilLateral(isLoggedIn) {
    const authBox = document.querySelector('.user-profile') || document.querySelector('#sidebar-auth-container') || document.querySelector('.auth-section-sidebar');
    if (!authBox) return;

    if (isLoggedIn) {
        authBox.outerHTML = `
        <div class="user-profile" id="sidebar-auth-container">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC</span>
                <span class="user-role">Desenvolvedor</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" style="cursor:pointer; color:#f43f5e;" onclick="window.logout()" title="Sair da Conta"></i>
        </div>`;
    } else {
        authBox.outerHTML = `
        <div class="auth-section-sidebar" id="sidebar-auth-container">
            <a href="login.html" class="btn-sidebar-login">
                <i class="fas fa-sign-in-alt"></i> Fazer Login
            </a>
        </div>`;
    }
}

window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.reload(); 
}