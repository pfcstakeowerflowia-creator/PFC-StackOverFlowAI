document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificação de Autenticação e Perfil
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    renderizarPerfilLateral(isLoggedIn);

    // 2. Controle de Acessibilidade (Modo de Alto Contraste)
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

    // 3. Mapeamento de Elementos do DOM
    const chatInputBtn = document.getElementById('btn-send');
    const chatTextArea = document.getElementById('user-input');
    const msgArea = document.getElementById('chat-messages');
    const btnNewChat = document.getElementById('btn-new-chat');
    const chatHeaderTitle = document.getElementById('current-chat-header-title');

    const fileInput = document.getElementById('file-input');
    const attachBtn = document.querySelector('.attach-btn');
    const previewBar = document.getElementById('attachment-preview-bar');
    const previewFilename = document.getElementById('preview-filename');
    const previewIcon = document.getElementById('preview-icon');
    const removeAttachmentBtn = document.getElementById('btn-remove-attachment');

    // Menu Mobile (Drawer)
    const openSidebarBtn = document.getElementById('btn-open-sidebar');
    const closeSidebarBtn = document.getElementById('btn-close-sidebar');
    const sidebar = document.querySelector('.side-panel');
    const overlay = document.getElementById('sidebar-overlay');

    let selectedFile = null;
    let currentChatId = null; // ID da conversa ativa no MongoDB Atlas

    // 4. Detecção Inteligente da URL da API (Resolve porta 5500 do Live Server, 3000 e Produção)
    const BASE_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? (window.location.port === '3000' ? '/api' : 'http://localhost:3000/api')
        : '/api';

    // Carregamento Inicial do Histórico vindo do MongoDB
    carregarHistoricoSidebar();

    // Controle do Menu Mobile
    function toggleSidebar(open) {
        if (sidebar) sidebar.classList.toggle('open', open);
        if (overlay) overlay.classList.toggle('active', open);
    }

    if (openSidebarBtn) openSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));

    // Botão de Nova Conversa
    if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
            iniciarNovoChat();
            if (window.innerWidth <= 850) toggleSidebar(false);
        });
    }

    // Gerenciador de Seleção de Anexos (Imagens, PDFs, Códigos)
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Limite de segurança de 15MB
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

    // 5. Envio de Mensagens e Redimensionamento Automático
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

            // Renderiza anexo na bolha do usuário
            let attachmentHTML = '';
            if (selectedFile) {
                if (selectedFile.mimeType.startsWith('image/')) {
                    attachmentHTML = `<div style="margin-top: 10px;"><img src="data:${selectedFile.mimeType};base64,${selectedFile.base64}" style="max-width: 280px; max-height: 200px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);" alt="Anexo"></div>`;
                } else {
                    attachmentHTML = `<div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 8px; font-size: 13px;"><i class="fas fa-paperclip"></i> <span>${selectedFile.name}</span></div>`;
                }
            }

            const safeMsg = msgDigitada.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Exibe mensagem do usuário imediatamente
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message user-message" style="margin-top: 20px;">
                <div class="message-content"> 
                    <p style="white-space: pre-wrap;">${safeMsg}</p> 
                    ${attachmentHTML}
                </div>
            </article>`);

            const backupFileToSend = selectedFile;
            chatTextArea.value = ''; 
            chatTextArea.style.height = '24px'; 
            selectedFile = null;
            if (fileInput) fileInput.value = '';
            if (previewBar) previewBar.style.display = 'none';
            msgArea.scrollTop = msgArea.scrollHeight;

            // Indicador de Carregamento
            const iconeOriginalBtn = chatInputBtn.innerHTML; 
            chatInputBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
            chatInputBtn.disabled = true;

            const loadingId = 'loading-' + Date.now();
            msgArea.insertAdjacentHTML('beforeend', `
            <article class="message ai-message" id="${loadingId}">
                <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <p style="color: var(--text-secondary);"><i class="fas fa-circle-notch fa-spin"></i> Consultando base do Fórum (RAG) e salvando no MongoDB...</p>
                </div>
            </article>`);
            msgArea.scrollTop = msgArea.scrollHeight;

            try {
                const response = await fetch(`${BASE_API}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        mensagem: msgDigitada,
                        arquivo: backupFileToSend,
                        chatId: currentChatId
                    })
                });

                const data = await response.json();
                
                const loadingElement = document.getElementById(loadingId);
                if (loadingElement) loadingElement.remove();

                // Atualiza o ID da conversa ativa e o título no cabeçalho
                if (data.chatId) {
                    currentChatId = data.chatId;
                    if (chatHeaderTitle && data.title) {
                        chatHeaderTitle.innerText = data.title;
                    }
                    carregarHistoricoSidebar();
                }

                // Converte Markdown seguro com DOMPurify
                const rawHTML = marked.parse(data.resposta || "Nenhuma resposta retornada.");
                const cleanHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHTML) : rawHTML;

                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        ${cleanHTML}
                    </div>
                </article>`);

                // Aplica destaque de sintaxe em códigos
                if (typeof hljs !== 'undefined') {
                    document.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                        adicionarBotaoCopiar(block);
                    });
                }

            } catch (error) {
                console.error("Erro na comunicação com a API:", error);
                const loadingElement = document.getElementById(loadingId);
                if (loadingElement) loadingElement.remove();

                msgArea.insertAdjacentHTML('beforeend', `
                <article class="message ai-message">
                    <div class="avatar-ai"><i class="fas fa-exclamation-triangle" style="color:#f43f5e;"></i></div>
                    <div class="message-content" style="border-color:#f43f5e; color:#f43f5e;">
                        <strong>[Erro de Conexão]:</strong> ${error.message}
                    </div>
                </article>`);
            } finally {
                chatInputBtn.innerHTML = iconeOriginalBtn; 
                chatInputBtn.disabled = false; 
                msgArea.scrollTop = msgArea.scrollHeight;
            }
        }
    }

    // 6. Funções de Gestão de Conversas com o MongoDB Atlas
    async function carregarHistoricoSidebar() {
        const listContainer = document.getElementById('chat-history-list');
        if (!listContainer) return;

        try {
            // Linha que agora busca corretamente no Node.js (porta 3000)
            const res = await fetch(`${BASE_API}/chats`);
            if (!res.ok) throw new Error("Erro ao buscar histórico");
            const chats = await res.json();

            listContainer.innerHTML = '';

            if (chats.length === 0) {
                listContainer.innerHTML = `<li style="color: var(--text-secondary); font-size: 12px; padding: 8px;">Nenhuma conversa anterior salva.</li>`;
                return;
            }

            chats.forEach(c => {
                const isActive = c._id === currentChatId ? 'active' : '';
                const li = document.createElement('li');
                li.className = isActive;
                li.tabIndex = 0;
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';

                li.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; cursor:pointer;" title="${c.title}">
                        <i class="far fa-message"></i> <span>${c.title}</span>
                    </div>
                    <button class="btn-delete-chat" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px; transition: color 0.2s;" title="Excluir conversa">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;

                // Clicar no título da conversa restaura as mensagens
                li.querySelector('div').addEventListener('click', () => {
                    carregarConversaPorId(c._id, c.title);
                    if (window.innerWidth <= 850) toggleSidebar(false);
                });

                // Clicar na lixeira remove a conversa do banco
                li.querySelector('.btn-delete-chat').addEventListener('click', (e) => {
                    e.stopPropagation();
                    excluirConversa(c._id);
                });

                listContainer.appendChild(li);
            });

        } catch (err) {
            listContainer.innerHTML = `<li style="color: #f43f5e; font-size: 11px; padding: 8px;">Falha ao carregar histórico do banco.</li>`;
        }
    }

    async function carregarConversaPorId(id, titulo) {
        try {
            const res = await fetch(`${BASE_API}/chats/${id}`);
            if (!res.ok) throw new Error("Falha ao abrir a conversa.");
            const chat = await res.json();

            currentChatId = chat._id;
            if (chatHeaderTitle) chatHeaderTitle.innerText = titulo || chat.title;

            msgArea.innerHTML = '';

            // Renderiza todo o histórico de mensagens
            chat.messages.forEach(m => {
                if (m.sender === 'user') {
                    const safeMsg = m.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    let attachmentHTML = '';
                    if (m.attachment && m.attachment.name) {
                        attachmentHTML = `<div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 8px; font-size: 13px;"><i class="fas fa-paperclip"></i> <span>${m.attachment.name}</span></div>`;
                    }
                    msgArea.insertAdjacentHTML('beforeend', `
                    <article class="message user-message" style="margin-top: 20px;">
                        <div class="message-content"> 
                            <p style="white-space: pre-wrap;">${safeMsg}</p> 
                            ${attachmentHTML}
                        </div>
                    </article>`);
                } else {
                    const rawHTML = marked.parse(m.text || "");
                    const cleanHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHTML) : rawHTML;
                    msgArea.insertAdjacentHTML('beforeend', `
                    <article class="message ai-message">
                        <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                        <div class="message-content">${cleanHTML}</div>
                    </article>`);
                }
            });

            // Aplica realce nos blocos de código recuperados
            if (typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                    adicionarBotaoCopiar(block);
                });
            }

            carregarHistoricoSidebar();
            msgArea.scrollTop = msgArea.scrollHeight;

        } catch (err) {
            alert("Não foi possível carregar a conversa: " + err.message);
        }
    }

    async function excluirConversa(id) {
        if (!confirm("Tem certeza de que deseja apagar esta conversa do MongoDB Atlas?")) return;
        try {
            const res = await fetch(`${BASE_API}/chats/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (currentChatId === id) {
                    iniciarNovoChat();
                } else {
                    carregarHistoricoSidebar();
                }
            }
        } catch (err) {
            alert("Erro ao excluir conversa: " + err.message);
        }
    }

    function iniciarNovoChat() {
        currentChatId = null;
        if (chatHeaderTitle) chatHeaderTitle.innerText = "Assistente Técnico Inteligente";
        msgArea.innerHTML = `
        <article class="message ai-message">
            <div class="avatar-ai" aria-hidden="true"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <p>Nova conversa iniciada! Todas as mensagens serão salvas automaticamente na nuvem no <strong>MongoDB Atlas</strong>.</p>
            </div>
        </article>`;
        carregarHistoricoSidebar();
        if (chatTextArea) chatTextArea.focus();
    }
});

// Adiciona botão "Copiar" nos blocos de código
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

// Renderiza o perfil na Sidebar com suporte a Aluno e Administrador
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

// Logout Completo de Sessão
window.logout = function() {
    localStorage.removeItem('isLoggedIn'); 
    localStorage.removeItem('userId');
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    window.location.reload(); 
};