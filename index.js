// --- Arquivo: index.js (Da Forma Correta e Polida) ---
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Verifica estado inicial na memória
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // 2. Mapeamento do DOM do chat 
    const chatInputBtn = document.querySelector('.send-btn');
    const chatTextArea = document.querySelector('.input-box textarea');
    const msgArea = document.querySelector('.messages-area');

    if (chatInputBtn && chatTextArea && msgArea) {
        
        // Escuta clicar com o MOUSE
        chatInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            enviarMsgChat();
        });

        // Escuta ENTER no Teclado ("keydown" ao invés de keypress é muito melhor p/ forms textareas!)
        chatTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                enviarMsgChat(); 
            }
        });

        // ==========================
        // FLUXO DO BOT MOCKADO DA IA 
        // ==========================
        function enviarMsgChat() {
            // Kick/Barrado: Evita do Aluno postar perguntas e acessar banco se estiver Deslogado 
            if (!isLoggedIn) {
                window.location.href = 'login.html'; 
                return;
            }

            // Remove buracos em branco 
            const msgDigitada = chatTextArea.value.trim();
            if (!msgDigitada) return;

            // Tratativa RAG Fake de XSS AntiHacking:
            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Exibição Gráfica Usuário: HTML da Pergunta Aluno 
            msgArea.insertAdjacentHTML('beforeend', `
            <div class="message user-message" style="margin-top:20px;">
                <div class="message-content"> 
                    <p>${safeMsg}</p> 
                </div>
            </div>`);

            // Zerar campo e Rolar Automático o Scrollbar pra visão seguir embaixo.
            chatTextArea.value = '';
            msgArea.scrollTop = msgArea.scrollHeight; 

            // UX UI PROFISSIONAL - Transforma a Seta/Submit num circulo Load rodando ("loading ai"); 
            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            // Delay Virtual (Cria Efeito Sensorial de uma Consulta real da Api a base)
            setTimeout(() => {
                
                chatInputBtn.innerHTML = iconeOriginalBtn; // Botão de Enter / Load devolve seta !
                chatInputBtn.disabled = false; // Permite input novamente !

                msgArea.insertAdjacentHTML('beforeend', `
                <div class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        <p>Feedback detectado a chave: <strong>"${safeMsg.substring(0,25)}..."</strong></p><br>
                        <p>Recebido em Base Isolada modular com muito exíto e segurança na prevenção de código.<br>Em etapa Backend nós consumiremos as dúvidas RAG daqui da "<code>Overflowia UI</code>". Excelente estrutura semântica Aluno(a)! Posso auxiliar como Assistente de Código algo agora? </p>
                    </div>
                </div>`);

                // Mantem Fixado Scroll inferior apos o AI responder e pular os Pixels...
                msgArea.scrollTop = msgArea.scrollHeight;
                
            }, 1200);  // Simulou "processamento IA GPT/Lanchain por  1,2s realístico. 
        }
    }
});


// Função Isloada Invocada. Componentizou Barra Lateral "UI Estado Perfil": 
function renderizarPerfilLateral(isLoggedIn) {
    const authBox = document.querySelector('.user-profile') || document.querySelector('#sidebar-auth-container') || document.querySelector('.auth-section-sidebar');
    
    // Tratativa Break Null Pts se classe inexistir
    if (!authBox) return;

    if (isLoggedIn) {
        authBox.outerHTML = `
        <div class="user-profile" id="sidebar-auth-container">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC</span>
                <span class="user-role">Autenticado / AI Dev</span>
            </div>
            <!-- Ao pressionar deslogamos o Usuario RAG!   -->
            <i class="fas fa-sign-out-alt config-btn text-danger" style="cursor:pointer; font-size:18px; color:#f43f5e; transition:0.3s;" onclick="window.logout()" title="Sair Oficial"></i>
        </div>`;
    } else {
        // Garantimos aqui FallBack puro Styles (Cor do botão para Não "Destruir a Barra Menu Index se Estilo perder Herança na página");
        authBox.outerHTML = `
        <div class="auth-section-sidebar" id="sidebar-auth-container" style="margin-top:20px; border-top: 1px solid var(--border-color); padding-top:20px;">
            <a href="login.html" class="btn-sidebar-login" style="display: flex; justify-content:center; align-items:center; gap:8px; padding: 12px; border: 1px solid var(--accent-color); color: var(--accent-color); border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                <i class="fas fa-sign-in-alt"></i> Portal de Acesso!
            </a>
        </div>`;
    }
}

// Window garante "O Scope Funcionario pro Click do index HTMl bater perfeito." 
window.logout = function() {
    localStorage.removeItem('isLoggedIn'); // Excluí Autoridade Rota (Is Logado vira undefined/nulo);
    window.location.reload(); 
}