document.addEventListener("DOMContentLoaded", async () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

   const BASE_API = (window.location.protocol === 'file:')
    ? 'http://localhost:3000/api'
    : '/api';

    const feedView = document.getElementById('forum-feed-view');
    const threadView = document.getElementById('forum-thread-view');
    const btnBackToFeed = document.getElementById('btn-back-to-feed');
    const btnNavForum = document.getElementById('btn-nav-forum');

    const threadTitle = document.getElementById('so-thread-title');
    const threadMeta = document.getElementById('so-thread-meta');
    const questionText = document.getElementById('so-question-text');
    const questionTags = document.getElementById('so-question-tags');
    const questionVotes = document.getElementById('so-question-votes');
    const questionSolvedIcon = document.getElementById('so-question-solved-icon');
    const questionAuthorCard = document.getElementById('so-question-author-card');
    const questionAdminActions = document.getElementById('so-question-admin-actions');
    const btnQUpvote = document.getElementById('btn-q-upvote');

    const aiContentBox = document.getElementById('so-ai-answer-content');
    const btnGenerateAI = document.getElementById('btn-generate-ai-thread');
    const btnIaText = document.getElementById('btn-ia-text');

    const answersCount = document.getElementById('so-answers-count');
    const communityAnswersList = document.getElementById('so-community-answers-list');

    const formYourAnswer = document.getElementById('so-form-your-answer');
    const answerInput = document.getElementById('so-answer-input');

    let activePostId = null;

    function exibirFeed() {
        feedView.style.display = 'flex';
        threadView.style.display = 'none';
        activePostId = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function exibirThread() {
        feedView.style.display = 'none';
        threadView.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (btnBackToFeed) btnBackToFeed.addEventListener('click', exibirFeed);
    if (btnNavForum) btnNavForum.addEventListener('click', exibirFeed);

    // Filtros do Feed
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

    // =================================================================
    // 1. CARREGAR FEED PRINCIPAL (IMAGEM 1)
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
                    <button class="btn-delete-post" onclick="event.stopPropagation(); window.excluirPost('${item._id}')" title="Excluir pergunta">
                        <i class="fas fa-trash-alt"></i> Excluir
                    </button>
                ` : '';

                const cardHTML = `
                <div class="question-card ${item.statusResolvido ? 'solved' : ''}" id="card-${item._id}" onclick="window.abrirPaginaPergunta('${item._id}')">
                    <div class="stats" onclick="event.stopPropagation();">
                        <span class="votes" id="vote-${item._id}">${item.votos || 0}</span> 
                        <i class="fas fa-caret-up upvote-btn" onclick="window.votar('${item._id}', this)" title="Votar"></i> 
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
            feedContainer.innerHTML = `<p style="color:#f43f5e; text-align:center; padding:20px;">Erro ao carregar o feed do banco.</p>`;
        }
    }

    // =================================================================
    // 2. ABRIR PÁGINA COMPLETA DA PERGUNTA (STACK OVERFLOW - IMAGEM 2)
    // =================================================================
    window.abrirPaginaPergunta = async function(postId) {
        activePostId = postId;

        threadTitle.innerText = "Carregando pergunta...";
        questionText.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Buscando no MongoDB Atlas...`;
        threadMeta.innerHTML = '';
        aiContentBox.innerHTML = '';
        communityAnswersList.innerHTML = '';
        questionAdminActions.innerHTML = '';

        if (btnGenerateAI) {
            btnGenerateAI.disabled = false;
            btnIaText.innerText = "Gerar Solução com IA";
        }

        exibirThread();

        try {
            const res = await fetch(`${BASE_API}/posts/${postId}`);
            if (!res.ok) throw new Error("Pergunta não encontrada no banco.");
            const post = await res.json();

            // Metadados do Stack Overflow
            threadTitle.innerText = post.titulo;
            const dataFormatada = new Date(post.createdAt || Date.now()).toLocaleDateString('pt-BR');

            threadMeta.innerHTML = `
                <span>Perguntado: <strong>${dataFormatada}</strong></span>
                <span>Votos: <strong>${post.votos || 0}</strong></span>
                <span>Status: <strong style="color:${post.statusResolvido ? 'var(--success-color)' : 'var(--so-orange)'};">${post.statusResolvido ? 'Resolvido ✓' : 'Em aberto'}</strong></span>
            `;

            // Calha de Votos da Pergunta
            questionVotes.innerText = post.votos || 0;
            questionSolvedIcon.style.display = post.statusResolvido ? 'block' : 'none';

            if (btnQUpvote) {
                btnQUpvote.onclick = () => window.votar(post._id);
            }

            // Descrição da Pergunta com Markdown
            const rawDescHTML = marked.parse(post.desc || "");
            questionText.innerHTML = DOMPurify.sanitize(rawDescHTML);

            const tagsArray = Array.isArray(post.tags) ? post.tags : ["RAG"];
            questionTags.innerHTML = tagsArray.map(t => `<span class="tag"># ${escaparHTML(t)}</span>`).join('');

            // Ação de Excluir Pergunta
            const userRole = localStorage.getItem('userRole') || 'aluno';
            const usuarioLogado = localStorage.getItem('userName') || '';
            if (userRole === 'admin' || (usuarioLogado && post.author === usuarioLogado)) {
                questionAdminActions.innerHTML = `
                    <button class="btn-delete-post" onclick="window.excluirPostEPegarFeed('${post._id}')">
                        <i class="fas fa-trash-alt"></i> Excluir esta Pergunta
                    </button>
                `;
            }

            // Card de Autor
            questionAuthorCard.innerHTML = `
                <span class="so-author-date">perguntado em ${dataFormatada}</span>
                <div class="so-author-profile">
                    <div class="so-author-avatar"><i class="fas fa-user"></i></div>
                    <div>
                        <div class="so-author-name">${escaparHTML(post.author || "Aluno PFC")}</div>
                        <div class="so-author-badge">Autor da Dúvida</div>
                    </div>
                </div>
            `;

            // Resposta da IA (Gemini)
            const respostas = Array.isArray(post.respostas) ? post.respostas : [];
            const respostaIA = respostas.find(r => r.tipo === 'ia');

            if (respostaIA) {
                const rawAIHTML = marked.parse(respostaIA.texto || "");
                aiContentBox.innerHTML = DOMPurify.sanitize(rawAIHTML);
                if (btnGenerateAI) {
                    btnGenerateAI.disabled = true;
                    btnIaText.innerText = "IA Já Respondeu";
                }
            } else {
                aiContentBox.innerHTML = `
                    <p class="empty-ai-msg">
                        <i class="fas fa-info-circle"></i> A IA ainda não respondeu a este tópico. Clique no botão acima para formular a solução com Gemini.
                    </p>
                `;
            }

            // Respostas da Comunidade + Comentários
            const respostasHumanas = respostas.filter(r => r.tipo === 'humano');
            answersCount.innerText = respostasHumanas.length;

            if (respostasHumanas.length === 0) {
                communityAnswersList.innerHTML = `
                    <p style="color: var(--text-secondary); font-size: 14px; font-style: italic; padding: 15px 0;">
                        Nenhuma resposta da comunidade ainda. Seja o primeiro a responder abaixo!
                    </p>
                `;
            } else {
                const podeDefinirSolucao = (userRole === 'admin') || (usuarioLogado && post.author === usuarioLogado);
                communityAnswersList.innerHTML = '';

                respostasHumanas.forEach(resp => {
                    const rawRespHTML = marked.parse(resp.texto || "");
                    const cleanRespHTML = DOMPurify.sanitize(rawRespHTML);
                    const dataResp = new Date(resp.createdAt || Date.now()).toLocaleDateString('pt-BR');

                    const checkmarkSolucao = podeDefinirSolucao ? `
                        <div class="so-gutter-check ${resp.isMelhorResposta ? 'active' : ''}" onclick="window.alternarMelhorResposta('${post._id}', '${resp._id}')" title="${resp.isMelhorResposta ? 'Solução aceita (clique para desmarcar)' : 'Marcar como melhor resposta'}">
                            <i class="fas fa-check" style="${resp.isMelhorResposta ? 'color:var(--success-color);' : 'color:var(--text-secondary); opacity:0.35;'}"></i>
                        </div>
                    ` : (resp.isMelhorResposta ? `<div class="so-gutter-check"><i class="fas fa-check" style="color:var(--success-color);"></i></div>` : '');

                    // Renderização dos Comentários da Resposta
                    const comentarios = Array.isArray(resp.comentarios) ? resp.comentarios : [];
                    let comentariosHTML = comentarios.map(c => `
                        <div class="so-comment-item">
                            <span>${escaparHTML(c.texto)}</span>
                            – <span class="so-comment-author">${escaparHTML(c.autor)}</span>
                            <span class="so-comment-date">${new Date(c.createdAt || Date.now()).toLocaleDateString('pt-BR')}</span>
                        </div>
                    `).join('');

                    const cardRespostaHTML = `
                    <div class="so-main-post-layout" id="resp-${resp._id}">
                        <!-- Coluna de Votos da Resposta -->
                        <div class="so-left-vote-gutter">
                            <button class="so-gutter-btn" title="Esta resposta é útil"><i class="fas fa-caret-up"></i></button>
                            <span class="so-gutter-vote-count">${resp.votos || 0}</span>
                            <button class="so-gutter-btn" title="Esta resposta não é útil"><i class="fas fa-caret-down"></i></button>
                            ${checkmarkSolucao}
                        </div>

                        <!-- Conteúdo da Resposta + Comentários -->
                        <div class="so-right-post-body">
                            <div class="so-markdown-content">${cleanRespHTML}</div>
                            
                            <div class="so-post-bottom-bar">
                                <div></div>
                                <div class="so-author-card">
                                    <span class="so-author-date">respondido em ${dataResp}</span>
                                    <div class="so-author-profile">
                                        <div class="so-author-avatar" style="${resp.role === 'admin' ? 'color:#00d2d3;' : ''}">
                                            <i class="fas fa-${resp.role === 'admin' ? 'user-shield' : 'user'}"></i>
                                        </div>
                                        <div>
                                            <div class="so-author-name" style="${resp.role === 'admin' ? 'color:#00d2d3;' : ''}">${escaparHTML(resp.autor)}</div>
                                            <div class="so-author-badge">${resp.role === 'admin' ? 'Administrador' : 'Aluno da Comunidade'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Seção de Comentários da Resposta -->
                            <div class="so-comments-section">
                                <div id="comments-list-${resp._id}">${comentariosHTML}</div>
                                
                                <button class="so-add-comment-btn" onclick="window.toggleFormComentario('${resp._id}')">
                                    <i class="far fa-comment-dots"></i> Adicionar um comentário
                                </button>
                                
                                <div id="comment-form-wrap-${resp._id}" class="so-comment-inline-form" style="display: none;">
                                    <input type="text" id="comment-input-${resp._id}" class="so-comment-input" placeholder="Escreva seu comentário/dúvida sobre esta resposta...">
                                    <button class="so-comment-submit-btn" onclick="window.enviarComentario('${post._id}', '${resp._id}')">Enviar</button>
                                </div>
                            </div>

                        </div>
                    </div>`;

                    communityAnswersList.insertAdjacentHTML('beforeend', cardRespostaHTML);
                });
            }

            aplicarHighlightECopia();

        } catch (error) {
            alert("Erro ao abrir a pergunta: " + error.message);
            exibirFeed();
        }
    };

    // =================================================================
    // 3. ENVIAR COMENTÁRIO EM UMA RESPOSTA ESPECÍFICA
    // =================================================================
    window.toggleFormComentario = function(respId) {
        const wrap = document.getElementById(`comment-form-wrap-${respId}`);
        if (!wrap) return;
        const estaVisivel = wrap.style.display === 'flex';
        wrap.style.display = estaVisivel ? 'none' : 'flex';
        if (!estaVisivel) {
            const input = document.getElementById(`comment-input-${respId}`);
            if (input) input.focus();
        }
    };

    window.enviarComentario = async function(postId, respId) {
        if (!isLoggedIn) {
            alert("Você precisa fazer login para comentar!");
            window.location.href = 'login.html';
            return;
        }

        const input = document.getElementById(`comment-input-${respId}`);
        if (!input) return;
        const texto = input.value.trim();
        if (!texto) return;

        const autor = localStorage.getItem('userName') || "Aluno PFC Logado";
        const role = localStorage.getItem('userRole') || "aluno";

        try {
            const res = await fetch(`${BASE_API}/posts/${postId}/respostas/${respId}/comentarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto, autor, role })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                window.abrirPaginaPergunta(postId); // Recarrega com o novo comentário
            } else {
                alert("Erro ao enviar comentário: " + (data.error || "Falha desconhecida."));
            }
        } catch (err) {
            alert("Erro de conexão ao comentar: " + err.message);
        }
    };

    // =================================================================
    // 4. ACIONAR GERADOR DE IA (GEMINI)
    // =================================================================
    if (btnGenerateAI) {
        btnGenerateAI.addEventListener('click', async () => {
            if (!activePostId) return;

            btnGenerateAI.disabled = true;
            btnIaText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando com Gemini...';

            aiContentBox.innerHTML = `
                <div style="text-align: center; padding: 25px; color: var(--bot-color);">
                    <i class="fas fa-circle-notch fa-spin fa-2x"></i>
                    <p style="margin-top: 10px; font-size: 14px;">O assistente Overflowia.AI está formulando a solução técnica...</p>
                </div>
            `;

            try {
                const res = await fetch(`${BASE_API}/posts/${activePostId}/gerar-resposta-ia`, { method: 'POST' });
                const data = await res.json();

                if (res.ok && data.success) {
                    const rawHTML = marked.parse(data.resposta.texto || "");
                    aiContentBox.innerHTML = DOMPurify.sanitize(rawHTML);
                    btnIaText.innerText = "IA Já Respondeu";
                    aplicarHighlightECopia();
                } else {
                    alert("Erro ao gerar IA: " + (data.error || "Falha desconhecida."));
                    btnGenerateAI.disabled = false;
                    btnIaText.innerText = "Tentar Novamente";
                }
            } catch (err) {
                alert("Erro de conexão com a IA: " + err.message);
                btnGenerateAI.disabled = false;
                btnIaText.innerText = "Tentar Novamente";
            }
        });
    }

    // =================================================================
    // 5. SUBMETER RESPOSTA HUMANA (YOUR ANSWER)
    // =================================================================
    if (formYourAnswer) {
        formYourAnswer.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!isLoggedIn) {
                alert("Você precisa fazer login para responder!");
                window.location.href = 'login.html';
                return;
            }

            if (!activePostId) return;
            const texto = answerInput.value.trim();
            if (!texto) return;

            const submitBtn = document.getElementById('btn-submit-answer');
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
                    answerInput.value = '';
                    window.abrirPaginaPergunta(activePostId);
                } else {
                    alert("Falha ao salvar: " + (data.error || "Erro desconhecido."));
                }
            } catch (err) {
                alert("Erro de conexão ao enviar: " + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // =================================================================
    // 6. ALTERNAR MELHOR RESPOSTA
    // =================================================================
    window.alternarMelhorResposta = async function(postId, respId) {
        try {
            const res = await fetch(`${BASE_API}/posts/${postId}/respostas/${respId}/solucao`, { method: 'PATCH' });
            if (res.ok) {
                window.abrirPaginaPergunta(postId);
            } else {
                alert("Não foi possível alternar a melhor resposta.");
            }
        } catch (err) {
            console.error("Erro ao definir melhor resposta:", err);
        }
    };

    carregarPosts(filtroAtual);
});

// =================================================================
// 7. UTILITÁRIOS
// =================================================================

function aplicarHighlightECopia() {
    if (typeof hljs !== 'undefined') {
        document.querySelectorAll('.so-page-wrapper pre code').forEach((block) => {
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

window.excluirPost = async function(id) {
    if (!confirm("Tem certeza de que deseja apagar esta pergunta do fórum?")) return;

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
        }
    } catch (error) {
        console.error("Erro ao excluir post:", error);
    }
};

window.excluirPostEPegarFeed = async function(id) {
    if (!confirm("Tem certeza de que deseja apagar esta pergunta do fórum?")) return;

    try {
        const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
            ? `http://localhost:3000/api/posts/${id}`
            : `https://pfc-stackoverflowai.onrender.com/api/posts/${id}`;

        const res = await fetch(URL_API, { method: 'DELETE' });

        if (res.ok) {
            window.location.reload();
        }
    } catch (error) {
        console.error("Erro ao excluir:", error);
    }
};

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
            const qVotes = document.getElementById('so-question-votes');
            if (qVotes) {
                qVotes.innerText = data.votos;
            }
            if (btnElement) {
                btnElement.classList.add('voted');
                btnElement.style.color = '#00d2d3';
                btnElement.style.transform = 'scale(1.2)';
            }
        }
    } catch (error) {
        console.error("Erro ao computar voto:", error);
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

window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    localStorage.removeItem('userId');
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    window.location.reload(); 
};