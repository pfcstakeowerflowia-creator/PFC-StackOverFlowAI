document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'login.html'; 
        return; 
    }
    renderizarPerfilLateral(isLoggedIn);

    const askForm = document.querySelector('.ask-form');
    if (askForm) {
        askForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const novoPost = {
                titulo: document.getElementById('ask-title').value,
                desc: document.getElementById('ask-desc').value,
                tags: ["RAG", "Base de Dados"], 
                author: "Aluno PFC"
            };

            try {
                // ENVIA PARA O MONGODB VIA RENDER OU LOCAL
                const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:3000/api/posts'
                    : 'https://pfc-stackoverflowai.onrender.com/api/posts';
                const response = await fetch(URL_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoPost)
                });

                if (response.ok) {
                    alert("✅ Pergunta salva com sucesso no Banco de Dados!");
                    window.location.href = 'forum.html';
                } else {
                    alert("❌ Falha ao salvar no servidor.");
                }
            } catch (error) {
                console.error("erro geral:" + error);
                alert("❌ Erro de conexão com o banco.");
            }
        });
    }
});

function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if(wrapper && isLoggedIn) {
         wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" style="cursor:pointer;" onclick="window.logout()"></i>
        </div>`;
    }
}
window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html'; 
}