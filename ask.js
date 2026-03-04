document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    // REGRA DE SEGURANÇA: Se não estiver logado, chuta para o login na mesma hora
    if (!isLoggedIn) {
        window.location.href = 'login.html';
        return; 
    }

    renderizarPerfilLateral(isLoggedIn);

    // Evento para simular o envio da pergunta
    const askForm = document.querySelector('.ask-form');
    if (askForm) {
        askForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert("✅ Sucesso! Pergunta submetida ao Fórum da Comunidade Humana e leitura da IA.");
            window.location.href = 'forum.html';
        });
    }
});

function renderizarPerfilLateral(isLoggedIn) {
    const authBox = document.querySelector('.user-profile') || document.querySelector('#sidebar-auth-container');
    if (!authBox) return;
    authBox.outerHTML = `
    <div class="user-profile" id="sidebar-auth-container">
        <div class="avatar"><i class="fas fa-user"></i></div>
        <div class="user-info">
            <span class="user-name">Aluno PFC</span>
            <span class="user-role">Desenvolvedor</span>
        </div>
        <i class="fas fa-sign-out-alt config-btn text-danger" style="cursor:pointer; color:#f43f5e;" onclick="window.logout()"></i>
    </div>`;
}

window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'forum.html'; 
}