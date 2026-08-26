document.addEventListener("DOMContentLoaded", async () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // Mapeamento da URL da API (Local vs Render)
    const BASE_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? 'http://localhost:3000/api'
        : 'https://pfc-stackoverflowai.onrender.com/api';

    // Elementos do Modal de Discussão
    const threadModal = document.getElementById('thread-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnGenerateAI = document.getElementById('btn-generate-ai-answer');
    const formHumanAnswer = document.getElementById('form-human-answer');
    const humanAnswerText = document.getElementById('human-answer-text');

    let activePostId = null; // ID da dúvida atualmente aberta no modal

    // Botão de Nova Pergunta
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

    // Gerenciador de Filtros do Feed
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
            if (textoBtn.includes('votadas') || textoBtn.includes('relevantes')) {
                filtroAtual = 'relevantes';
            } else if (textoBtn.includes('resolvida') || textoBtn.includes('sucesso')) {
                filtroAtual = 'resolvidos';
            } else {
                filtroAtual = 'recentes';
            }

            carregarPosts(filtroAtual);
        });
    });

    // Fechar Modal
    function fecharModal() {
        if (threadModal) threadModal.style.display = 'none';
        activePostId = null;
    }

    if (btnCloseModal) btnCloseModal.addEventListener('click', fecharModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', fecharModal);

    // Fechar Modal com a tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && threadModal && threadModal.style.display === 'flex') {
            fecharModal();
        }
    });

    // =================================================================
    // 1. CARREGAR E RENDERIZAR O FEED DO FÓRUM
    // =================================================================
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
            const response = await fetch(`${BASE_API}/posts`);
            if (!response.ok) throw new Error("Falha ao consultar servidor.");
            
            let posts = await response.json();

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

            const userRole = localStorage.getItem('userRole') || 'aluno';
            const usuarioLogado = localStorage.getItem('userName') || '';

            posts.forEach((item) => {
                const statusBadge = item.statusResolvido 
                    ? `<span class="best-answer-badge"><i class="fas fa-check-circle"></i> Resolvido</span>` 
                    : ``;

                const totalRespostas = Array.isArray(item.respostas) ? item.respostas.length : 0;
                const temRespostaIA = Array.isArray(item.respostas) && item.respostas.some(r => r.tipo === 'ia');

                const badgeIA = temRespostaIA 
                    ? `<span class="answers-count-badge" style="color: var(--bot-color); border-color: rgba(0, 210, 211, 0.3);"><i class="fas fa-robot"></i> IA Respondeu</span>` 
                    : '';

                const tagsArray = Array.isArray(item.tags) ? item.tags : ["RAG", "Geral"];
                const formataTags = tagsArray.map(t => `<span class="tag"># ${escaparHTML(t)}</span>`).join('');

                const podeExcluir = (userRole === 'admin') || (usuarioLogado && item.author === usuarioLogado);

                const botaoExcluir = podeExcluir ? `
                    <button class="btn-delete-post" onclick="event.stopPropagation(); window.excluirPost('${item._id}')" title="Excluir pergunta do fórum">
                        <i class="fas fa-trash-alt"></i> Excluir
                    </button>
                ` : '';

                const cardHTML = `
                <div class="question-card ${item.statusResolvido ? 'solved' : ''}" id="card-${item._id}" onclick="window.abrirModalThread('${item._id}')">
                    <div class="stats" onclick="event.stopPropagation();">
                        <div class="stat-item">
                            <span class="votes" id="vote-${item._id}">${item.votos || 0}</span> 
                            <i class="fas fa-caret-up upvote-btn" onclick="window.votar('${item._id}', this)" title="Votar positivamente"></i> 
                        </div>
                    </div>
                    <div class="question-content">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                            <h3>${escaparHTML(item.titulo)}</h3>
                            ${botaoExcluir}
                        </div>
                        <p>${escaparHTML(item.desc)}</p>
                        <div class="question-footer">
                            <div class="tags">${formataTags}</div>
                            <div class="status-indicators">
                                ${badgeIA}
                                <span class="answers-count-badge"><i class="fas fa-comments"></i> ${totalRespostas} respostas</span>
                                ${statusBadge}
                                <div class="author-info"><i class="fas fa-user-circle"></i> ${escaparHTML(item.author || "Aluno PFC")}</div>
                            </div>
                        </div>
                    </div>
                </div>`;

                feedContainer.insertAdjacentHTML('beforeend', cardHTML);
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

    // =================================================================
    // 2. ABRIR E PREENCHER O MODAL DE DISCUSSÃO (HUMANO + IA)
    // =================================================================
    window.abrirModalThread = async function(postId) {
        activePostId = postId;

        const modalTitle = document.getElementById('modal-thread-title');
        const modalAuthor = document.getElementById('modal-thread-author');
        const modalTags = document.getElementById('modal-thread-tags');
        const modalDesc = document.getElementById('modal-thread-desc');
        const modalStatus = document.getElementById('modal-thread-status');
        const aiContainer = document.getElementById('modal-ai-answer-container');
        const answersList = document.getElementById('modal-community-answers-list');
        const answersCount = document.getElementById('modal-answers-count');
        const btnIaText = document.getElementById('btn-ia-text');

        // Limpa estados anteriores
        modalTitle.innerText = "Carregando detalhes da dúvida...";
        modalDesc.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Buscando no MongoDB Atlas...`;
        modalTags.innerHTML = '';
        aiContainer.innerHTML = '';
        answersList.innerHTML = '';
        if (btnGenerateAI) {
            btnGenerateAI.disabled = false;
            btnIaText.innerText = "Gerar Resposta com IA";
        }

        threadModal.style.display = 'flex';

        try {
            const res = await fetch(`${BASE_API}/posts/${postId}`);
            if (!res.ok) throw new Error("Dúvida não encontrada.");
            const post = await res.json();

            // Preenche dados da Pergunta Original
            modalTitle.innerText = post.titulo;
            modalAuthor.innerHTML = `<i class="fas fa-user-circle"></i> Postado por <strong>${escaparHTML(post.author || "Aluno PFC")}</strong>`;
            
            modalStatus.style.display = post.statusResolvido ? 'inline-flex' : 'none';

            const tagsArray = Array.isArray(post.tags) ? post.tags : ["RAG"];
            modalTags.innerHTML = tagsArray.map(t => `<span class="tag"># ${escaparHTML(t)}</span>`).join('');

            // Renderiza descrição com Markdown
            const rawDescHTML = marked.parse(post.desc || "");
            modalDesc.innerHTML = DOMPurify.sanitize(rawDescHTML);

            // 1. Processa a Resposta da IA
            const respostas = Array.isArray(post.respostas) ? post.respostas : [];
            const respostaIA = respostas.find(r => r.tipo === 'ia');

            if (respostaIA) {
                renderizarRespostaIA(respostaIA.texto);
                if (btnGenerateAI) {
                    btnGenerateAI.disabled = true;
                    btnIaText.innerText = "IA Já Respondeu";
                }
            } else {
                aiContainer.innerHTML = `
                    <p class="empty-ai-msg">
                        <i class="fas fa-info-circle"></i> A IA ainda não respondeu a esta dúvida. Clique no botão acima para gerar a solução técnica com Gemini.
                    </p>
                `;
            }

            // 2. Processa Respostas Humanas da Comunidade
            renderizarRespostasComunidade(respostas.filter(r => r.tipo === 'humano'), post);

            // Aplica highlight.js e botões de copiar
            aplicarHighlightECopia();

        } catch (error) {
            alert("Erro ao abrir discussão: " + error.message);
            fecharModal();
        }
    };

    function renderizarRespostaIA(textoMarkdown) {
        const aiContainer = document.getElementById('modal-ai-answer-container');
        const rawHTML = marked.parse(textoMarkdown || "");
        const cleanHTML = DOMPurify.sanitize(rawHTML);

        aiContainer.innerHTML = `
            <div class="ai-answer-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(0, 210, 211, 0.2);">
                <span style="color:var(--bot-color); font-weight:600; font-size:13px;"><i class="fas fa-check-double"></i> Solução Gerada por Inteligência Artificial</span>
                <span style="font-size:11px; color:var(--text-secondary);">Modelo: Gemini 2.5</span>
            </div>
            <div class="ai-answer-content">${cleanHTML}</div>
        `;
    }

    function renderizarRespostasComunidade(respostasHumanas, post) {
        const answersList = document.getElementById('modal-community-answers-list');
        const answersCount = document.getElementById('modal-answers-count');
        
        answersCount.innerText = respostasHumanas.length;
        answersList.innerHTML = '';

        if (respostasHumanas.length === 0) {
            answersList.innerHTML = `
                <p style="color: var(--text-secondary); font-size: 13px; font-style: italic; padding: 10px 0;">
                    Nenhum aluno respondeu ainda. Seja o primeiro a ajudar enviando sua resposta abaixo!
                </p>
            `;
            return;
        }

        const usuarioLogado = localStorage.getItem('userName') || '';
        const userRole = localStorage.getItem('userRole') || 'aluno';
        const podeDefinirSolucao = (userRole === 'admin') || (usuarioLogado && post.author === usuarioLogado);

        respostasHumanas.forEach(resp => {
            const rawHTML = marked.parse(resp.texto || "");
            const cleanHTML = DOMPurify.sanitize(rawHTML);

            const badgeCargo = resp.role === 'admin' 
                ? '<span style="color:#00d2d3; font-size:11px; margin-left:6px;"><i class="fas fa-shield-alt"></i> Admin</span>' 
                : '<span style="color:var(--text-secondary); font-size:11px; margin-left:6px;"><i class="fas fa-user-graduate"></i> Aluno</span>';

            const botaoSolucao = podeDefinirSolucao ? `
                <button class="btn-mark-solution ${resp.isMelhorResposta ? 'active' : ''}" onclick="window.alternarMelhorResposta('${post._id}', '${resp._id}')">
                    <i class="fas fa-star"></i> ${resp.isMelhorResposta ? 'Solução Aceita' : 'Marcar como Solução'}
                </button>
            ` : (resp.isMelhorResposta ? `<span class="best-answer-badge"><i class="fas fa-check-circle"></i> Solução Aceita</span>` : '');

            const cardHTML = `
            <div class="answer-card-human ${resp.isMelhorResposta ? 'is-solution' : ''}" id="resp-${resp._id}">
                <div class="answer-card-header">
                    <div class="author-info">
                        <i class="fas fa-user-circle"></i> <strong>${escaparHTML(resp.autor)}</strong> ${badgeCargo}
                    </div>
                    ${botaoSolucao}
                </div>
                <div class="answer-card-body">${cleanHTML}</div>
            </div>`;

            answersList.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // =================================================================
    // 3. ACIONAR GERADOR DE RESPOSTA DA IA (GOOGLE GEMINI)
    // =================================================================
    if (btnGenerateAI) {
        btnGenerateAI.addEventListener('click', async () => {
            if (!activePostId) return;

            const btnIaText = document.getElementById('btn-ia-text');
            const aiContainer = document.getElementById('modal-ai-answer-container');

            btnGenerateAI.disabled = true;
            btnIaText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando com Gemini...';

            aiContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--bot-color);">
                    <i class="fas fa-circle-notch fa-spin fa-2x"></i>
                    <p style="margin-top: 10px; font-size: 13.5px;">O assistente Overflowia.AI está analisando seu código e formulando a solução técnica...</p>
                </div>
            `;

            try {
                const res = await fetch(`${BASE_API}/posts/${activePostId}/gerar-resposta-ia`, {
                    method: 'POST'
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    renderizarRespostaIA(data.resposta.texto);
                    btnIaText.innerText = "IA Já Respondeu";
                    aplicarHighlightECopia();
                    carregarPosts(filtroAtual); // Atualiza o feed
                } else {
                    alert("Erro ao gerar resposta da IA: " + (data.error || "Falha desconhecida."));
                    btnGenerateAI.disabled = false;
                    btnIaText.innerText = "Tentar Novamente";
                }
            } catch (err) {
                alert("Erro de conexão ao acionar IA: " + err.message);
                btnGenerateAI.disabled = false;
                btnIaText.innerText = "Tentar Novamente";
            }
        });
    }

    // =================================================================
    // 4. SUBMETER RESPOSTA HUMANA
    // =================================================================
    if (formHumanAnswer) {
        formHumanAnswer.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!isLoggedIn) {
                alert("Você precisa estar logado para publicar uma resposta!");
                window.location.href = 'login.html';
                return;
            }

            if (!activePostId) return;

            const texto = humanAnswerText.value.trim();
            if (!texto) return;

            const submitBtn = document.getElementById('btn-submit-human-answer');
            const originalText = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';

            const autor = localStorage.getItem('userName') || "Aluno PFC Logado";
            const role = localStorage.getItem('userRole') || "aluno";

            try {
                const res = await fetch(`${BASE_API}/posts/${activePostId}/respostas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto, autor, role })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    humanAnswerText.value = '';
                    // Recarrega a lista no modal
                    window.abrirModalThread(activePostId);
                    carregarPosts(filtroAtual); // Atualiza o feed
                } else {
                    alert("Falha ao salvar resposta: " + (data.error || "Erro desconhecido."));
                }
            } catch (err) {
                alert("Erro de conexão ao enviar resposta: " + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // =================================================================
    // 5. ALTERNAR MELHOR RESPOSTA (SOLUÇÃO ACEITA)
    // =================================================================
    window.alternarMelhorResposta = async function(postId, respId) {
        try {
            const res = await fetch(`${BASE_API}/posts/${postId}/respostas/${respId}/solucao`, {
                method: 'PATCH'
            });

            if (res.ok) {
                // Atualiza o modal aberto e o feed
                window.abrirModalThread(postId);
                carregarPosts(filtroAtual);
            } else {
                alert("Não foi possível definir a solução oficial.");
            }
        } catch (err) {
            console.error("Erro ao alternar solução:", err);
        }
    };

    // 6. Carregamento inicial do feed
    carregarPosts(filtroAtual);
});

// =================================================================
// 6. UTILITÁRIOS: HIGHLIGHT, COPIAR, EXCLUIR E PERFIL
// =================================================================

function aplicarHighlightECopia() {
    if (typeof hljs !== 'undefined') {
        document.querySelectorAll('.thread-modal-body pre code').forEach((block) => {
            hljs.highlightElement(block);
            adicionarBotaoCopiar(block);
        });
    }
}

function adicionarBotaoCopiar(codeBlock) {
    const pre = codeBlock.parentElement;
    if (pre && !pre.querySelector('.copy-code-btn')) {
        pre.style.position = 'relative';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
        
        copyBtn.addEventListener('click', async () => {
            await navigator.clipboard.writeText(codeBlock.innerText);
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
            copyBtn.style.background = 'rgba(74, 222, 128, 0.2)';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
                copyBtn.style.background = 'rgba(255,255,255,0.08)';
            }, 2000);
        });

        pre.appendChild(copyBtn);
    }
}

// Excluir Postagem no MongoDB Atlas
window.excluirPost = async function(id) {
    if (!confirm("Tem certeza de que deseja apagar esta pergunta do fórum e da base RAG?")) {
        return;
    }

    try {
        const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
            ? `http://localhost:3000/api/posts/${id}`
            : `https://pfc-stackoverflowai.onrender.com/api/posts/${id}`;

        const res = await fetch(URL_API, { method: 'DELETE' });

        if (res.ok) {
            const card = document.getElementById(`card-${id}`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95)';
                card.style.transition = 'all 0.3s ease';
                setTimeout(() => card.remove(), 300);
            }
        } else {
            const err = await res.json().catch(() => ({}));
            alert("❌ Falha ao excluir: " + (err.error || "Erro desconhecido."));
        }
    } catch (error) {
        console.error("Erro ao excluir post:", error);
        alert("❌ Erro de conexão ao tentar excluir a pergunta.");
    }
};

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

function escaparHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Renderiza Perfil na Sidebar
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;

    if (isLoggedIn) {
        const nomeUsuario = localStorage.getItem('userName') || "Aluno PFC";
        const role = localStorage.getItem('userRole') || "aluno";
        
        const badgeRole = role === 'admin' 
            ? '<span style="color: #00d2d3; font-size: 11px; font-weight: 600;"><i class="fas fa-shield-alt"></i> Administrador</span>' 
            : '<span style="color: var(--text-secondary); font-size: 11px;"><i class="fas fa-user-graduate"></i> Aluno PFC</span>';

        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar" style="${role === 'admin' ? 'border: 1px solid #00d2d3;' : ''}">
                <i class="fas fa-${role === 'admin' ? 'user-shield' : 'user'}" style="${role === 'admin' ? 'color: #00d2d3;' : ''}"></i>
            </div>
            <div class="user-info">
                <span class="user-name">${escaparHTML(nomeUsuario)}</span>
                <span class="user-role">${badgeRole}</span>
            </div>
            <button class="icon-btn text-danger" onclick="window.logout()" style="background:none; border:none; cursor:pointer;" title="Desconectar"><i class="fas fa-sign-out-alt"></i></button>
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
    localStorage.removeItem('userId');
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    window.location.reload(); 
};