document.addEventListener("DOMContentLoaded", () => {
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

    // -------------------------------------
    // SIMULADOR DO FEED BANCO DB LOCAL APP
    // -------------------------------------
    const feedContainer = document.getElementById('forum-feed-container');

    const basePadraoMockDeInicializacaoDB = [
        {
            id: 'kPdxMock1', 
            titulo: "Erro Cors no Express Deploy Server", 
            desc: "Estou tendo dor de cabeça enorme tentando apontar a UI React minha com minha API Express que consome openai/LangChain. Aparece access header Error! Pf AJuda humanos do rag e ia!!", 
            tags: ["express", "nodejs", "cors", "db"], 
            votos: 14, author: "TechStudent_", statusResolvido: true 
        },
        {
            id: 'kVtzMock2', 
            titulo: "Centering Div usando css display table. Esta Depreciado?", 
            desc: "Poderia nossa Inteligencia e Alunos do Senai confirmarem isso de boas práticas antigas na programação web hoje?",
            tags: ["css3", "design", "html"], 
            votos: 2, author: "JulianoUI_Front", statusResolvido: false 
        }
    ];

    let itemsPublicadosDoMembroAPPLocalDB = JSON.parse(localStorage.getItem('RAG_Perguntas_Dev')) || [];

    const ARRAY_GLOBAL = [...itemsPublicadosDoMembroAPPLocalDB, ...basePadraoMockDeInicializacaoDB];

    if(feedContainer) {
        feedContainer.innerHTML = ''; 

        ARRAY_GLOBAL.forEach((itemUnidadeLoopForPost) => {
            let classeVerdinhaSolvidaCSS_CardSide = itemUnidadeLoopForPost.statusResolvido ? "solved" : "";
            let htmlBotSolveIndicator = itemUnidadeLoopForPost.statusResolvido ? `<span class="best-answer-badge"><i class="fas fa-check-circle"></i> Resolve Status / By Humano & IA</span>` : ``;
            let formataHTMLAsTAGSBotoesCopiadoCardBase = itemUnidadeLoopForPost.tags.map(tagsStringsT => `<span class="tag"># ${tagsStringsT}</span>`).join('');

            feedContainer.innerHTML += `
            <div class="question-card ${classeVerdinhaSolvidaCSS_CardSide}">
                
                <div class="stats">
                    <div class="stat-item"><span class="votes" id="contadorRenderViewVoteSpan_${itemUnidadeLoopForPost.id}">${itemUnidadeLoopForPost.votos}</span> 
                        <i class="fas fa-caret-up upvote-btn" onclick="contarVotacaoSistemaDOM_UXSimulacaoClickerMagicaUIUX('${itemUnidadeLoopForPost.id}')" title="Computar um Valor no RAG Pergunta Criterio UP-VOTE System Votation !"></i> 
                    </div>
                    
                    <div class="stat-item answers-segmented">
                        <div class="ans-badge human active-ans"><i class="fas fa-user"></i> ${itemUnidadeLoopForPost.statusResolvido ? '3' : '1'}</div>
                        <div class="ans-badge bot active-bot"><i class="fas fa-robot"></i> 1 Assist Bot RAG IA System</div>
                    </div>
                </div>

                <div class="question-content">
                    <h3>${itemUnidadeLoopForPost.titulo}</h3>
                    <p>${itemUnidadeLoopForPost.desc}</p>
                    
                    <div class="question-footer">
                        <div class="tags">${formataHTMLAsTAGSBotoesCopiadoCardBase}</div>
                        <div class="status-indicators">
                            ${htmlBotSolveIndicator}
                            <div class="author-info"><i class="fas fa-user-circle"></i> Autor Thread Origin: ${itemUnidadeLoopForPost.author}  </div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }
});

// A Função UX Interativa Exposta P Global Windw Escopo -> Mágica dos Votos Visuais!! //
window.contarVotacaoSistemaDOM_UXSimulacaoClickerMagicaUIUX = function(IDRandomDataMILIseccondKeyUniqueDOMAppenderPass) {
    const PegoContadorDoPost_AlvoElementHTML = document.getElementById(`contadorRenderViewVoteSpan_${IDRandomDataMILIseccondKeyUniqueDOMAppenderPass}`);
    if(!PegoContadorDoPost_AlvoElementHTML) return; 

    let converterLetTextoInternoParseadoValueToReal_MatNumber = parseInt(PegoContadorDoPost_AlvoElementHTML.innerText);
    converterLetTextoInternoParseadoValueToReal_MatNumber += 1; 

    PegoContadorDoPost_AlvoElementHTML.innerText = converterLetTextoInternoParseadoValueToReal_MatNumber;
    PegoContadorDoPost_AlvoElementHTML.style.color = '#00d2d3'; 
};


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
            <i class="fas fa-sign-out-alt config-btn text-danger" onclick="window.logout()" title="Força Retirada Limpa Locas DB" style="font-size:16px;"></i>
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