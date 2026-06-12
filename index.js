document.addEventListener("DOMContentLoaded", () => {
    
    // Verifica se o usuário está logado
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // Controle de Alto Contraste (Acessibilidade)
    const btnContrast = document.getElementById('toggle-contrast');
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }

    if (btnContrast) {
        btnContrast.addEventListener('click', () => {
            const isEnabled = document.body.classList.toggle('high-contrast');
            localStorage.setItem('highContrast', isEnabled);
        });
    }

    // Elementos do Chat
    const chatInputBtn = document.getElementById('btn-send');
    const chatTextArea = document.getElementById('user-input');
    const msgArea = document.getElementById('chat-messages');

    if (chatInputBtn && chatTextArea && msgArea) {
        
        // Clique no botão de enviar
        chatInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            enviarMsgChat();
        });

        // Enviar com a tecla "Enter"
        chatTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                enviarMsgChat(); 
            }
        });

        async function enviarMsgChat() {
            // Se não estiver logado, manda para o login
            if (!isLoggedIn) {
                alert("Baka! Você precisa fazer login para falar comigo!");
                window.location.href = 'login.html'; 
                return;
            }

            const msgDigitada = chatTextArea.value.trim();
            if (!msgDigitada) return;

            // Limpa caracteres especiais para evitar erros
            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // 1. Mostrar a mensagem do usuário na tela
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message user-message" style="margin-top:20px;">
                <div class="message-content"> <p>${safeMsg}</p> </div>
            </article>`);

            chatTextArea.value = ''; // Limpa o campo
            msgArea.scrollTop = msgArea.scrollHeight; // Rola para baixo

            // Estado de carregamento no botão
            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            // --- CONFIGURAÇÃO DA URL DA API ---
          // QUANDO TESTAR NO PC:
const URL_API = 'http://localhost:3000/api/chat'; 

// QUANDO SUBIR PARA O RENDER (Aí você troca):
// const URL_API = 'https://seu-projeto-overflowia.onrender.com/api/chat';
            // const URL_API = 'https://pfc-stackoverflowai.onrender.com/api/chat';

            try {
                // 2. Chama o Backend
                const response = await fetch(URL_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mensagem: msgDigitada })
                });

                if (!response.ok) throw new Error("Erro no servidor");

                const data = await response.json();

                // --- UPGRADE VISUAL (Sprint 0): MARKDOWN PARA HTML ---
                // O marked.parse transforma a resposta da IA em HTML formatado
                const respostaFormatada = marked.parse(data.resposta);

                // 3. Mostra a resposta da IA na tela
                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        ${respostaFormatada}
                    </div>
                </article>`);

            } catch (error) {
                console.error(error);
                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot" style="color:red;"></i></div>
                    <div class="message-content" style="border-color:red; color:red;">
                        <strong>[SISTEMA]:</strong> Erro Crítico! Verifique se o seu servidor Node.js está rodando ou se a API Key é válida.
                    </div>
                </article>`);
            } finally {
                chatInputBtn.innerHTML = iconeOriginalBtn; 
                chatInputBtn.disabled = false; 
                msgArea.scrollTop = msgArea.scrollHeight;
            }
        }
    }
});

/**
 * Função para renderizar o perfil na barra lateral
 */
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;
    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Usuário Tsundere</span>
                <span class="user-role">Autenticado</span>
            </div>
            <button class="icon-btn text-danger" onclick="window.logout()" style="background:none; border:none; cursor:pointer;"><i class="fas fa-sign-out-alt"></i></button>
        </div>`;
    } else {
        wrapper.innerHTML = `
        <div class="auth-section-sidebar">
            <a href="login.html" class="btn-sidebar-login"><i class="fas fa-sign-in-alt"></i> Fazer Login</a>
        </div>`;
    }
}

// Função de Logout
window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    window.location.reload(); 
}