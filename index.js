document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificação de Autenticação
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // 2. Controle de Acessibilidade (Alto Contraste)
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

    // 3. Mapeamento de Elementos do Chat
    const chatInputBtn = document.getElementById('btn-send');
    const chatTextArea = document.getElementById('user-input');
    const msgArea = document.getElementById('chat-messages');

    // 4. Mapeamento de Elementos de Anexo
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.querySelector('.attach-btn');
    const previewBar = document.getElementById('attachment-preview-bar');
    const previewFilename = document.getElementById('preview-filename');
    const previewIcon = document.getElementById('preview-icon');
    const removeAttachmentBtn = document.getElementById('btn-remove-attachment');

    let selectedFile = null;

    // Gerenciador de Seleção de Arquivo / Print
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Limite de segurança de até 15MB
            if (file.size > 15 * 1024 * 1024) {
                alert("O arquivo excede o limite permitido de 15MB!");
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                const rawBase64 = evt.target.result.split(',')[1];
                selectedFile = {
                    base64: rawBase64,
                    mimeType: file.type || 'application/octet-stream',
                    name: file.name
                };

                if (file.type.startsWith('image/')) {
                    previewIcon.className = 'fas fa-file-image';
                } else if (file.type === 'application/pdf') {
                    previewIcon.className = 'fas fa-file-pdf';
                } else {
                    previewIcon.className = 'fas fa-file-code';
                }

                previewFilename.textContent = file.name;
                previewBar.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        });
    }

    if (removeAttachmentBtn) {
        removeAttachmentBtn.addEventListener('click', () => {
            selectedFile = null;
            if (fileInput) fileInput.value = '';
            if (previewBar) previewBar.style.display = 'none';
        });
    }

    // Função Global para preencher o chat com sugestões rápidas
    window.inserirExemplo = function(texto) {
        if (chatTextArea) {
            chatTextArea.value = texto;
            chatTextArea.focus();
            chatTextArea.dispatchEvent(new Event('input'));
        }
    };

    // 5. Configuração de Envio e Redimensionamento Automático
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

        chatTextArea.addEventListener('input', function() {
            this.style.height = '24px';
            const novaAltura = Math.min(this.scrollHeight, 200);
            this.style.height = novaAltura + 'px';
            this.style.overflowY = this.scrollHeight > 200 ? 'auto' : 'hidden';
        });

        // Função Principal de Envio
        async function enviarMsgChat() {
            if (!isLoggedIn) {
                alert("Você precisa estar logado para interagir com o assistente!");
                window.location.href = 'login.html'; 
                return;
            }

            const msgDigitada = chatTextArea.value.trim();
            if (!msgDigitada && !selectedFile) return;

            // Renderiza o anexo no balão do usuário se houver
            let attachmentHTML = '';
            if (selectedFile) {
                if (selectedFile.mimeType.startsWith('image/')) {
                    attachmentHTML = `<div style="margin-top: 10px;"><img src="data:${selectedFile.mimeType};base64,${selectedFile.base64}" style="max-width: 280px; max-height: 200px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);" alt="Anexo enviado"></div>`;
                } else {
                    attachmentHTML = `<div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 8px; font-size: 13px;">
                        <i class="fas fa-paperclip"></i> <span>${selectedFile.name}</span>
                    </div>`;
                }
            }

            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Exibe mensagem do usuário
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message user-message" style="margin-top: 20px;">
                <div class="message-content"> 
                    <p style="white-space: pre-wrap;">${safeMsg}</p> 
                    ${attachmentHTML}
                </div>
            </article>`);

            const backupFileToSend = selectedFile;

            // Limpa o formulário
            chatTextArea.value = ''; 
            chatTextArea.style.height = '24px'; 
            selectedFile = null;
            if (fileInput) fileInput.value = '';
            if (previewBar) previewBar.style.display = 'none';
            msgArea.scrollTop = msgArea.scrollHeight;

            // Exibe indicador de carregamento
            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            const loadingId = 'loading-' + Date.now();
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message ai-message" id="${loadingId}">
                <div class="avatar-ai" aria-hidden="true"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <p style="color: var(--text-secondary);">
                        <i class="fas fa-circle-notch fa-spin"></i> Consultando base do Fórum (RAG) e formulando resposta técnica...
                    </p>
                </div>
            </article>`);
            msgArea.scrollTop = msgArea.scrollHeight;

            // URL da API dinâmica (Local vs Produção Render)
            const URL_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
                ? 'http://localhost:3000/api/chat'
                : 'https://pfc-stackoverflowai.onrender.com/api/chat';

            try {
                const response = await fetch(URL_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        mensagem: msgDigitada,
                        arquivo: backupFileToSend
                    })
                });

                const data = await response.json();
                
                const loadingElement = document.getElementById(loadingId);
                if (loadingElement) loadingElement.remove();

                // Converte Markdown e sanitiza com DOMPurify
                const rawHTML = marked.parse(data.resposta || "Nenhuma resposta retornada.");
                const cleanHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHTML) : rawHTML;

                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        ${cleanHTML}
                    </div>
                </article>`);

                // Aplica realce de sintaxe com Highlight.js em blocos de código
                if (typeof hljs !== 'undefined') {
                    document.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                        adicionarBotaoCopiar(block);
                    });
                }

            } catch (error) {
                console.error("Erro na requisição:", error);
                const loadingElement = document.getElementById(loadingId);
                if (loadingElement) loadingElement.remove();

                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-exclamation-triangle" style="color:#f43f5e;"></i></div>
                    <div class="message-content" style="border-color:#f43f5e; color:#f43f5e;">
                        <strong>[Erro de Comunicação]:</strong> ${error.message}
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

// Adiciona botão "Copiar" no cabeçalho de cada bloco de código
function adicionarBotaoCopiar(codeBlock) {
    const pre = codeBlock.parentElement;
    if (pre && !pre.querySelector('.copy-code-btn')) {
        pre.style.position = 'relative';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
        copyBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.1); border: 1px solid var(--border-color); color: var(--text-primary); padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: 0.2s;';
        
        copyBtn.addEventListener('click', async () => {
            await navigator.clipboard.writeText(codeBlock.innerText);
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
            copyBtn.style.background = 'rgba(74, 222, 128, 0.2)';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
                copyBtn.style.background = 'rgba(255,255,255,0.1)';
            }, 2000);
        });

        pre.appendChild(copyBtn);
    }
}

// Renderização do Perfil na Sidebar
function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if (!wrapper) return;
    if (isLoggedIn) {
        wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Logado</span>
                <span class="user-role">Autenticado Local DB</span>
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

// Logout de Sessão
window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    window.location.reload(); 
};