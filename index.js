document.addEventListener("DOMContentLoaded", () => {
    
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

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

        async function enviarMsgChat() {
            if (!isLoggedIn) {
                window.location.href = 'login.html'; 
                return;
            }

            const msgDigitada = chatTextArea.value.trim();
            if (!msgDigitada) return;

            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message user-message" style="margin-top:20px;">
                <div class="message-content"> <p>${safeMsg}</p> </div>
            </article>`);

            chatTextArea.value = '';
            chatTextArea.style.height = '24px';
            msgArea.scrollTop = msgArea.scrollHeight; 

            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            try {
                // CHAMA O BACKEND NO RENDER
                const response = await fetch('https://pfc-stackoverflowai.onrender.com/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mensagem: msgDigitada })
                });

                if (!response.ok) throw new Error("Erro no servidor");

                const data = await response.json();

                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        ${data.resposta}
                    </div>
                </article>`);

            } catch (error) {
                console.error(error);
                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot" style="color:red;"></i></div>
                    <div class="message-content" style="border-color:red; color:red;">
                        <strong>Erro de Conexão:</strong> O servidor demorou a responder (Render dormindo) ou a API Key está errada.
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

function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;
    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
                <span class="user-role">Autenticado AI Chat</span>
            </div>
            <button class="icon-btn text-danger" onclick="window.logout()" style="background:none; border:none; cursor:pointer;"><i class="fas fa-sign-out-alt"></i></button>
        </div>`;
    } else {
        wrapper.innerHTML = `
        <div class="auth-section-sidebar">
            <a href="login.html" class="btn-sidebar-login"><i class="fas fa-sign-in-alt"></i> Fazer Login Seguro</a>
        </div>`;
    }
}

window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    window.location.reload(); 
}