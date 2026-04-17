document.addEventListener("DOMContentLoaded", () => {
    
    // 1. GERENCIAMENTO DE ESTADO DE LOGIN
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // 2. LÓGICA DE ALTO CONTRASTE (Acessibilidade Visual)
    const btnContrast = document.getElementById('toggle-contrast');
    
    // Verifica se a preferência de contraste já está salva no navegador
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }

    if (btnContrast) {
        btnContrast.addEventListener('click', () => {
            const isEnabled = document.body.classList.toggle('high-contrast');
            localStorage.setItem('highContrast', isEnabled);
            
            // Feedback sonoro para leitores de tela sobre a mudança de estado
            const statusMsg = isEnabled ? "Modo de alto contraste ativado" : "Modo de alto contraste desativado";
            console.log(statusMsg); // Opcional: pode-se usar um elemento com aria-live para anunciar isso.
        });
    }

    // 3. GERENCIAMENTO DO CHAT (Acessibilidade de Conteúdo)
    const chatInputBtn = document.getElementById('btn-send');
    const chatTextArea = document.getElementById('user-input');
    const msgArea = document.getElementById('chat-messages');

    if (chatInputBtn && chatTextArea && msgArea) {
        
        chatInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            enviarMsgChat();
        });

        chatTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                enviarMsgChat(); 
            }
        });

        function enviarMsgChat() {
            if (!isLoggedIn) {
                window.location.href = 'login.html'; 
                return;
            }

            const msgDigitada = chatTextArea.value.trim();
            if (!msgDigitada) return;

            // Sanitização básica contra XSS
            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Insere mensagem do usuário usando semântica de 'article' para acessibilidade
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message user-message" style="margin-top:20px;">
                <div class="message-content"> <p>${safeMsg}</p> </div>
            </article>`);

            // Reseta a área e foca no scroll base inferior 
            chatTextArea.value = '';
            chatTextArea.style.height = '24px';
            msgArea.scrollTop = msgArea.scrollHeight; 

            // Feedback Visual de Carregamento
            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>'; 
            chatInputBtn.disabled = true;
            chatInputBtn.setAttribute('aria-label', 'IA está processando...');

            // Simulação de resposta da IA
            setTimeout(() => {
                chatInputBtn.innerHTML = iconeOriginalBtn; 
                chatInputBtn.disabled = false; 
                chatInputBtn.setAttribute('aria-label', 'Enviar pergunta');

                // A div pai 'msgArea' tem aria-live="polite", então o leitor lerá isso automaticamente
                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai" aria-hidden="true"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        <p><strong>Resposta do Sistema:</strong> Mensagem recebida com Segurança: "${safeMsg.substring(0,25)}..."</p><br>
                        <p>Processamento do modelo estrutural completado! A Inteligência reconheceu sua requisição PFC e os requisitos de acessibilidade foram aplicados no retorno.</p>
                    </div>
                </article>`);

                msgArea.scrollTop = msgArea.scrollHeight;
            }, 1500);  
        }
    }
});

/**
 * Renderiza o perfil na barra lateral dependendo do estado de login.
 * Mantém a estrutura visual compatível com o style.css original.
 */
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;

    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar" aria-hidden="true"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
                <span class="user-role">Autenticado AI Chat</span>
            </div>
            <button class="icon-btn text-danger" onclick="window.logout()" title="Encerrar Sessão" aria-label="Sair da conta" style="background:none; border:none;">
                <i class="fas fa-sign-out-alt"></i>
            </button>
        </div>`;
    } else {
        wrapper.innerHTML = `
        <div class="auth-section-sidebar">
            <a href="login.html" class="btn-sidebar-login">
                <i class="fas fa-sign-in-alt" aria-hidden="true"></i> Fazer Login Seguro
            </a>
        </div>`;
    }
}

// Expõe a função logout globalmente para o clique no ícone
window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    window.location.reload(); 
}