document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificação de Autenticação
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        alert("Acesso restrito: faça login para submeter novos contextos ou dúvidas.");
        window.location.href = 'login.html'; 
        return; 
    }
    renderizarPerfilLateral(isLoggedIn);

    // 2. Manipulação do Formulário
    const askForm = document.querySelector('.ask-form');
    const submitBtn = document.querySelector('.submit-btn');

    if (askForm) {
        askForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tituloInput = document.getElementById('ask-title');
            const descInput = document.getElementById('ask-desc');

            const titulo = tituloInput ? tituloInput.value.trim() : '';
            const desc = descInput ? descInput.value.trim() : '';

            if (!titulo || !desc) {
                alert("Por favor, preencha o título e a descrição detalhada da dúvida.");
                return;
            }

            // Geração inteligente de tags baseada nas palavras-chave da dúvida
            const tagsDetectadas = extrairTagsTecnicas(titulo + " " + desc);

            const novoPost = {
                titulo: titulo,
                desc: desc,
                tags: tagsDetectadas,
                author: "Aluno PFC Logado",
                statusResolvido: false
            };

            // Estado de carregamento no botão
            const textoOriginalBtn = submitBtn ? submitBtn.innerHTML : 'Salvar';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Indexando no MongoDB Atlas...';
            }

            try {
                // Rota dinâmica: Local vs Produção no Render
                const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
                    ? 'http://localhost:3000/api/posts'
                    : 'https://pfc-stackoverflowai.onrender.com/api/posts';

                const response = await fetch(URL_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoPost)
                });

                if (response.ok) {
                    alert("✅ Post publicado e indexado com sucesso na base de conhecimento RAG!");
                    window.location.href = 'forum.html';
                } else {
                    const erroData = await response.json().catch(() => ({}));
                    alert("❌ Falha ao salvar no servidor: " + (erroData.error || "Erro desconhecido."));
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = textoOriginalBtn;
                    }
                }
            } catch (error) {
                console.error("Erro ao enviar post:", error);
                alert("❌ Erro de conexão com o banco de dados. Verifique se o servidor backend está rodando.");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginalBtn;
                }
            }
        });
    }
});

// Função para extrair tecnologias e palavras-chave para indexação RAG
function extrairTagsTecnicas(textoCompleto) {
    const texto = textoCompleto.toLowerCase();
    const tagsEncontradas = new Set(["RAG"]);

    const dicionarioTags = [
        "javascript", "js", "typescript", "ts", "node", "nodejs",
        "react", "html", "css", "flexbox", "grid", "python",
        "mongodb", "sql", "api", "rest", "jwt", "express",
        "gemini", "ia", "bugs", "arrays", "funções", "segurança"
    ];

    dicionarioTags.forEach(tag => {
        if (texto.includes(tag)) {
            tagsEncontradas.add(tag.toUpperCase());
        }
    });

    if (tagsEncontradas.size === 1) {
        tagsEncontradas.add("GERAL");
        tagsEncontradas.add("BASE LOCAL");
    }

    return Array.from(tagsEncontradas).slice(0, 4);
}

// Renderização do Perfil Lateral
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (wrapper && isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
                <span class="user-role">Autenticado Local DB</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" style="cursor:pointer;" onclick="window.logout()" title="Desconectar"></i>
        </div>`;
    }
}

// Logout de Sessão
window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html'; 
};