document.addEventListener("DOMContentLoaded", async () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    const askButton = document.getElementById('ask-button');
    if (askButton) {
        askButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (isLoggedIn) window.location.href = 'ask.html'; 
            else window.location.href = 'login.html'; 
        });
    }

    const feedContainer = document.getElementById('forum-feed-container');
    if (!feedContainer) return;

    try {
        // MUDANÇA: Buscando os dados do Render e MongoDB
        const response = await fetch('https://pfc-stackoverflowai.onrender.com/api/posts');
        const posts = await response.json();

        feedContainer.innerHTML = ''; 

        if(posts.length === 0) {
            feedContainer.innerHTML = '<p style="text-align:center; color:gray;">Nenhum post encontrado no banco de dados.</p>';
            return;
        }

        posts.forEach((item) => {
            let statusBadge = item.statusResolvido ? `<span class="best-answer-badge">Resolvido Pela IA</span>` : "";
            
            feedContainer.innerHTML += `
            <div class="question-card ${item.statusResolvido ? 'solved' : ''}">
                <div class="stats">
                    <div class="stat-item">
                        <span class="votes" id="vote-${item._id}">${item.votos}</span> 
                        <i class="fas fa-caret-up upvote-btn" onclick="votar('${item._id}')" title="Dar Upvote"></i>
                    </div>
                </div>
                <div class="question-content">
                    <h3>${item.titulo}</h3>
                    <p>${item.desc}</p>
                    <div class="author-info">Por: ${item.author}</div>
                    ${statusBadge}
                </div>
            </div>`;
        });
    } catch (error) {
        console.error("Erro:", error);
        feedContainer.innerHTML = "<p style='color:red;'>Erro ao carregar dados do MongoDB. Verifique se o servidor no Render está online.</p>";
    }
});

// MUDANÇA: Votando e salvando no Render/MongoDB
window.votar = async function(id) {
    try {
        const res = await fetch(`https://pfc-stackoverflowai.onrender.com/api/posts/${id}/vote`, { 
            method: 'PATCH' 
        });
        if(res.ok){
            const data = await res.json();
            const contador = document.getElementById(`vote-${id}`);
            contador.innerText = data.votos;
            contador.style.color = '#00d2d3';
        }
    } catch(err) {
        console.error("Erro ao votar:", err);
    }
}

function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;
    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
                <span class="user-role">Autenticado Local DB V</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" onclick="window.logout()" title="Sair" style="font-size:16px;"></i>
        </div>`;
    } else {
        wrapper.innerHTML = `
        <div class="auth-section-sidebar">
            <a href="login.html" class="btn-sidebar-login"><i class="fas fa-sign-in-alt"></i> Login Dev Local</a>
        </div>`;
    }
}

window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.reload(); 
}