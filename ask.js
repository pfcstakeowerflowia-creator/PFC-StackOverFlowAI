document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        alert("Acesso restrito: faça login para submeter novos tópicos.");
        window.location.href = 'login.html'; 
        return; 
    }
    renderizarPerfilLateral(isLoggedIn);

    const askForm = document.getElementById('form-ask-question') || document.querySelector('.ask-form');
    const submitBtn = document.getElementById('btn-submit-ask') || document.querySelector('.submit-btn');

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

            const tagsDetectadas = extrairTagsTecnicas(titulo + " " + desc);
            const nomeAutor = localStorage.getItem('userName') || "Aluno PFC Logado";

            const novoPost = {
                titulo: titulo,
                desc: desc,
                tags: tagsDetectadas,
                author: nomeAutor,
                statusResolvido: false
            };

            const textoOriginalBtn = submitBtn ? submitBtn.innerHTML : 'Publicar';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Indexando no MongoDB Atlas...';
            }

            try {
                const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
                    ? 'http://localhost:3000/api/posts'
                    : 'https://pfc-stackoverflowai.onrender.com/api/posts';

                const response = await fetch(URL_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoPost)
                });

                if (response.ok) {
                    alert("✅ Pergunta publicada e indexada com sucesso na base RAG!");
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
                alert("❌ Erro de conexão com o banco de dados.");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginalBtn;
                }
            }
        });
    }
});

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

function escaparHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    localStorage.removeItem('userId');
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    window.location.href = 'login.html'; 
};