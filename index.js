document.addEventListener("DOMContentLoaded", () => {
    
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    const chatInputBtn = document.querySelector('.send-btn');
    const chatTextArea = document.querySelector('.input-box textarea');
    const msgArea = document.querySelector('.messages-area');

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

            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            msgArea.insertAdjacentHTML('beforeend', `
            <div class="message user-message" style="margin-top:20px;">
                <div class="message-content"> <p>${safeMsg}</p> </div>
            </div>`);

            // Reseta a área e foca no scroll base inferior 
            chatTextArea.value = '';
            chatTextArea.style.height = '24px'; // Ajuste Visual de Input longo arrumado
            msgArea.scrollTop = msgArea.scrollHeight; 

            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            setTimeout(() => {
                chatInputBtn.innerHTML = iconeOriginalBtn; 
                chatInputBtn.disabled = false; 

                msgArea.insertAdjacentHTML('beforeend', `
                <div class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        <p>Mensagem recebida com Segurança: "${safeMsg.substring(0,25)}..."</p><br>
                        <p>Processamento do modelo estrutural completado! A Inteligência reconheceu sua requisição PFC!</p>
                    </div>
                </div>`);

                msgArea.scrollTop = msgArea.scrollHeight;
            }, 1500);  
        }
    }
});

// A RENDERIZAÇÃO ESTA BASEADA TOTALMENTE EM SUAS REGRAS CSS PRINCIPAIS STYLE.CSS !
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;

    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC</span>
                <span class="user-role">Autenticado AI Chat</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" onclick="window.logout()" title="Encerrar Sessão" style="font-size:16px;"></i>
        </div>`;
    } else {
        wrapper.innerHTML = `
        <div class="auth-section-sidebar">
            <a href="login.html" class="btn-sidebar-login">
                <i class="fas fa-sign-in-alt"></i> Fazer Login Seguro
            </a>
        </div>`;
    }
}

window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    window.location.reload(); 
}