document.addEventListener("DOMContentLoaded", async () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // Botão de Fazer Pergunta
    const askButton = document.getElementById('ask-button');
    if (askButton) {
        askButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (isLoggedIn) {
                window.location.href = 'ask.html';
            } else {
                alert("Você precisa estar logado para publicar uma dúvida no fórum!");
                window.location.href = 'login.html';
            }
        });
    }

    // Gerenciador de Filtros
    const filterButtons = document.querySelectorAll('.forum-filters button');
    let filtroAtual = 'recentes';

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');

            const textoBtn = btn.innerText.toLowerCase();
            if (textoBtn.includes('relevantes')) {
                filtroAtual = 'relevantes';
            } else if (textoBtn.includes('resolvida') || textoBtn.includes('sucesso')) {
                filtroAtual = 'resolvidos';
            } else {
                filtroAtual = 'recentes';
            }

            carregarPosts(filtroAtual);
        });
    });

    // Carregamento Inicial
    carregarPosts(filtroAtual);
});

// Função para buscar e renderizar postagens com suporte a filtros
async function carregarPosts(filtro = 'recentes') {
    const feedContainer = document.getElementById('forum-feed-container');
    if (!feedContainer) return;

    feedContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <i class="fas fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top: 10px;">Carregando perguntas da base do MongoDB...</p>
        </div>
    `;

    try {
        const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
            ? 'http://localhost:3000/api/posts'
            : 'https://pfc-stackoverflowai.onrender.com/api/posts';

        const response = await fetch(URL_API);
        if (!response.ok) throw new Error("Falha ao consultar servidor.");
        
        let posts = await response.json();

        // Aplica o filtro no cliente
        if (filtro === 'resolvidos') {
            posts = posts.filter(item => item.statusResolvido === true);
        } else if (filtro === 'relevantes') {
            posts = posts.sort((a, b) => (b.votos || 0) - (a.votos || 0));
        }

        feedContainer.innerHTML = '';

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div style="text-align: center; padding: 50px 20px; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border-color);">
                    <i class="fas fa-comments fa-3x" style="color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <p style="color: var(--text-primary); font-weight: 500;">Nenhuma dúvida encontrada para este filtro.</p>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-top: 5px;">Seja o primeiro a alimentar nossa base RAG com uma nova pergunta!</p>
                </div>
            `;
            return;
        }

        posts.forEach((item) => {
            const statusBadge = item.statusResolvido 
                ? `<span class="best-answer-badge"><i class="fas fa-check-circle"></i> Resolvido por IA/Comunidade</span>` 
                : ``;

            const tagsArray = Array.isArray(item.tags) ? item.tags : ["RAG", "Geral"];
            const formataTags = tagsArray.map(t => `<span class="tag"># ${escaparHTML(t)}</span>`).join('');

            feedContainer.innerHTML += `
            <div class="question-card ${item.statusResolvido ? 'solved' : ''}">
                <div class="stats">
                    <div class="stat-item">
                        <span class="votes" id="vote-${item._id}">${item.votos || 0}</span> 
                        <i class="fas fa-caret-up upvote-btn" onclick="window.votar('${item._id}', this)" title="Votar positivamente"></i> 
                    </div>
                </div>
                <div class="question-content">
                    <h3>${escaparHTML(item.titulo)}</h3>
                    <p>${escaparHTML(item.desc)}</p>
                    <div class="question-footer">
                        <div class="tags">${formataTags}</div>
                        <div class="status-indicators">
                            ${statusBadge}
                            <div class="author-info"><i class="fas fa-user-circle"></i> ${escaparHTML(item.author || "Aluno PFC")}</div>
                        </div>
                    </div>
                </div>
            </div>`;
        });

    } catch (error) {
        console.error("Erro ao carregar feed:", error);
        feedContainer.innerHTML = `
            <div style="text-align:center; padding: 30px; color: #f43f5e;">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p style="margin-top: 10px;">Não foi possível conectar ao banco de dados.</p>
                <button onclick="carregarPosts()" style="margin-top: 10px; background: var(--accent-color); color: white; border: none; padding: 6px 15px; border-radius: 6px; cursor: pointer;">Tentar Novamente</button>
            </div>
        `;
    }
}

// Computa voto positivo no MongoDB via PATCH
window.votar = async function(id, btnElement) {
    try {
        if (btnElement && btnElement.classList.contains('voted')) return;

        const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
            ? `http://localhost:3000/api/posts/${id}/vote`
            : `https://pfc-stackoverflowai.onrender.com/api/posts/${id}/vote`;

        const res = await fetch(URL_API, { method: 'PATCH' });
        if (res.ok) {
            const data = await res.json();
            const contador = document.getElementById(`vote-${id}`);
            if (contador) {
                contador.innerText = data.votos;
                contador.style.color = '#00d2d3';
            }
            if (btnElement) {
                btnElement.classList.add('voted');
                btnElement.style.color = '#00d2d3';
                btnElement.style.transform = 'scale(1.2)';
            }
        }
    } catch (error) {
        console.error("Erro ao registrar voto:", error);
    }
};

// Sanitizador simples para evitar injeção indevida no DOM
function escaparHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Renderiza o perfil lateral
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;
    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
                <span class="user-role">Autenticado Local DB</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" onclick="window.logout()" style="cursor:pointer; font-size:16px;" title="Desconectar"></i>
        </div>`;
    } else {
        wrapper.innerHTML = `
        <div class="auth-section-sidebar">
            <a href="login.html" class="btn-sidebar-login"><i class="fas fa-sign-in-alt"></i> Fazer Login</a>
        </div>`;
    }
}

// Logout de Sessão
window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
};