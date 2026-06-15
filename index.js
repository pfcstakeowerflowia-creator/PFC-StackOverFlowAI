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

    // Elementos do Sistema de Anexo (Adicionados para upload de arquivos)
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.querySelector('.attach-btn');
    const previewBar = document.getElementById('attachment-preview-bar');
    const previewFilename = document.getElementById('preview-filename');
    const previewIcon = document.getElementById('preview-icon');
    const removeAttachmentBtn = document.getElementById('btn-remove-attachment');

    let selectedFile = null; // Armazena os dados estruturados do anexo selecionado

    // Lógica para capturar e ler o arquivo ao clicar no botão de clipe de papel
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click(); // Abre a janela de seleção de arquivos do sistema
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Limite de segurança de até 4MB por anexo
            if (file.size > 4 * 1024 * 1024) {
                alert("O arquivo é muito grande! Escolha um arquivo de até 4MB.");
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                // Extrai apenas os dados base64 brutos
                const rawBase64 = evt.target.result.split(',')[1];

                selectedFile = {
                    base64: rawBase64,
                    mimeType: file.type,
                    name: file.name
                };

                // Define o ícone de exibição no preview de acordo com o tipo do arquivo
                if (file.type.startsWith('image/')) {
                    previewIcon.className = 'fas fa-file-image';
                } else if (file.type === 'application/pdf') {
                    previewIcon.className = 'fas fa-file-pdf';
                } else {
                    previewIcon.className = 'fas fa-file-alt';
                }

                // Renderiza a barra de preview
                previewFilename.textContent = file.name;
                previewBar.style.display = 'flex';
            };

            reader.readAsDataURL(file);
        });
    }

    // Botão de remoção do anexo na barra de preview
    if (removeAttachmentBtn) {
        removeAttachmentBtn.addEventListener('click', () => {
            selectedFile = null;
            if (fileInput) fileInput.value = '';
            if (previewBar) previewBar.style.display = 'none';
        });
    }

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

        // Ajuste automático de altura do campo de texto conforme o usuário digita
        chatTextArea.addEventListener('input', function() {
            this.style.height = '24px'; // Reseta a altura para recalcular
            const novaAltura = Math.min(this.scrollHeight, 150); // Limita o crescimento máximo a 150px
            this.style.height = novaAltura + 'px';
            
            // Exibe a barra de rolagem se o texto passar de 150px
            if (this.scrollHeight > 150) {
                this.style.overflowY = 'auto';
            } else {
                this.style.overflowY = 'hidden';
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
            if (!msgDigitada && !selectedFile) return;

            // Limpa caracteres especiais para evitar erros
            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Configura a visualização do anexo na bolha do chat do usuário
            let attachmentHTML = '';
            if (selectedFile) {
                if (selectedFile.mimeType.startsWith('image/')) {
                    // Renderiza a imagem diretamente
                    attachmentHTML = `<div style="margin-top: 8px;"><img src="data:${selectedFile.mimeType};base64,${selectedFile.base64}" style="max-width: 200px; max-height: 200px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2);" alt="Imagem Anexada"></div>`;
                } else {
                    // Renderiza uma tag com o nome do arquivo
                    attachmentHTML = `<div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 8px; font-size: 13px;">
                        <i class="fas fa-paperclip"></i> <span>${selectedFile.name}</span>
                    </div>`;
                }
            }

            // 1. Mostrar a mensagem do usuário na tela (incluindo o anexo se houver)
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message user-message" style="margin-top:20px;">
                <div class="message-content"> 
                    <p>${safeMsg}</p> 
                    ${attachmentHTML}
                </div>
            </article>`);

            // Backup temporário dos dados do arquivo para o envio
            const backupFileToSend = selectedFile;

            // Limpa o campo de texto e reseta os estados do anexo imediatamente
            chatTextArea.value = ''; 
            chatTextArea.style.height = '24px'; 
            chatTextArea.style.overflowY = 'hidden';
            selectedFile = null;
            if (fileInput) fileInput.value = '';
            if (previewBar) previewBar.style.display = 'none';

            msgArea.scrollTop = msgArea.scrollHeight; // Rola para baixo

            // Estado de carregamento no botão
            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            // --- CONFIGURAÇÃO AUTOMÁTICA DA URL DA API ---
            const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3000/api/chat'
                : 'https://pfc-stackoverflowai.onrender.com/api/chat';

            try {
                // 2. Chama o Backend enviando a mensagem e o arquivo associado
                const response = await fetch(URL_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        mensagem: msgDigitada,
                        arquivo: backupFileToSend
                    })
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