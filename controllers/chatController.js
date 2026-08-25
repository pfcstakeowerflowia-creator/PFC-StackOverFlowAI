
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");
const Chat = require("../models/chat"); // <-- Mude para 'chat' minúsculo

// 1. Enviar Mensagem, Consultar RAG e Salvar Interação no MongoDB
exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem || "";
        const arquivoUsuario = req.body.arquivo;
        let chatId = req.body.chatId;

        // Limpa e valida a chave da API
        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || "";
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) {
            return res.json({
                resposta: "⚠️ **Chave de API não configurada:** Adicione a variável `GEMINI_API_KEY` ao arquivo `.env` do servidor."
            });
        }

        // --- ETAPA 1: RAG (Recuperação de dúvidas relevantes no Fórum MongoDB) ---
        let contextoDb = [];
        try {
            if (msgUsuario.trim().length > 0) {
                // Remove caracteres especiais para evitar erros no Regex do Mongo (ex: C++, [], ())
                const palavrasChave = msgUsuario
                    .replace(/[^\w\sÀ-ú]/gi, '')
                    .split(/\s+/)
                    .filter(p => p.length > 3)
                    .slice(0, 5);

                if (palavrasChave.length > 0) {
                    const termoRegex = palavrasChave.join("|");
                    contextoDb = await Post.find({
                        $or: [
                            { titulo: { $regex: termoRegex, $options: "i" } },
                            { desc: { $regex: termoRegex, $options: "i" } },
                            { tags: { $regex: termoRegex, $options: "i" } }
                        ]
                    }).limit(3);
                }
            }
        } catch (dbErr) {
            console.warn("⚠️ Aviso RAG (busca textual ignorada):", dbErr.message);
        }

        const textoContexto = contextoDb.length > 0
            ? contextoDb.map(p => `• [Tópico Fórum]: "${p.titulo}"\n  Conteúdo/Solução: ${p.desc}`).join("\n\n")
            : "Nenhum post relevante encontrado no fórum local.";

        // --- ETAPA 2: Engenharia de Prompt e Instrução do Sistema ---
        const systemInstruction = `Você é o Overflowia.AI, uma inteligência artificial especialista em programação, algoritmos e engenharia de software.

DIRETRIZES:
1. Responda de forma completa, clara e tecnicamente aprofundada.
2. Nunca abrevie códigos com comentários como '// restante do código aqui'. Entregue a solução completa.
3. Use sempre blocos de código Markdown com a linguagem especificada (ex: \`\`\`javascript, \`\`\`html, \`\`\`css, \`\`\`python).
4. Utilize o [CONTEXTO DO FÓRUM LOCAL] se ele ajudar a responder à dúvida do usuário.

[CONTEXTO DO FÓRUM LOCAL]:
${textoContexto}`;

        const promptPrincipal = msgUsuario || "Analise o arquivo anexado e apresente a solução técnica completa.";
        const parts = [promptPrincipal];

        // Anexo multimodal se enviado pelo usuário
        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        // --- ETAPA 3: Geração com Gemini (Fallback em cascata) ---
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelos = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"];
        let respostaTexto = null;
        let erroUltimo = null;

        for (const nomeModelo of modelos) {
            try {
                const model = genAI.getGenerativeModel({
                    model: nomeModelo,
                    systemInstruction: systemInstruction,
                    generationConfig: { temperature: 0.7 }
                });

                const result = await model.generateContent(parts);
                const response = await result.response;
                respostaTexto = response.text();

                if (respostaTexto) {
                    console.log(`✅ Resposta gerada via modelo: ${nomeModelo}`);
                    break;
                }
            } catch (errModelo) {
                erroUltimo = errModelo;
                console.warn(`⚠️ Modelo ${nomeModelo} falhou. Tentando próximo da lista...`);
            }
        }

        if (!respostaTexto) {
            throw erroUltimo || new Error("Falha ao comunicar com os modelos de IA.");
        }

        // --- ETAPA 4: Persistência do Chat no MongoDB Atlas ---
        let chatDoc = null;
        const dadosMsgUsuario = {
            sender: 'user',
            text: msgUsuario,
            attachment: arquivoUsuario ? { name: arquivoUsuario.name, mimeType: arquivoUsuario.mimeType } : null
        };
        const dadosMsgIA = {
            sender: 'ai',
            text: respostaTexto
        };

        if (chatId) {
            // Conversa existente: anexa as mensagens ao documento
            chatDoc = await Chat.findById(chatId);
            if (chatDoc) {
                chatDoc.messages.push(dadosMsgUsuario);
                chatDoc.messages.push(dadosMsgIA);
                chatDoc.updatedAt = new Date();
                await chatDoc.save();
            }
        }

        if (!chatDoc) {
            // Nova conversa: cria um novo registro no MongoDB
            const tituloSintetico = msgUsuario.length > 35 
                ? msgUsuario.substring(0, 35) + "..." 
                : (msgUsuario || "Análise de Arquivo / Código");

            chatDoc = new Chat({
                title: tituloSintetico,
                author: "Aluno PFC Logado",
                messages: [dadosMsgUsuario, dadosMsgIA]
            });
            await chatDoc.save();
            chatId = chatDoc._id;
        }

        // Retorna a resposta junto com o ID e título da conversa no MongoDB
        return res.json({
            resposta: respostaTexto,
            chatId: chatDoc._id,
            title: chatDoc.title
        });

    } catch (error) {
        console.error("❌ Erro no chatController:", error.message);
        return res.json({
            resposta: `⚠️ **Falha no processamento da IA:**\n\n\`${error.message}\`\n\n*Dica: Verifique se sua GEMINI_API_KEY no .env é válida.*`
        });
    }
};

// 2. Listar todas as conversas salvas no MongoDB (para preencher a sidebar)
exports.listarConversas = async (req, res) => {
    try {
        const conversas = await Chat.find({}, '_id title updatedAt createdAt')
            .sort({ updatedAt: -1 })
            .limit(25);
        return res.json(conversas);
    } catch (error) {
        console.error("Erro ao listar conversas:", error.message);
        return res.status(500).json({ error: "Erro ao listar conversas do banco." });
    }
};

// 3. Obter uma conversa específica com todas as mensagens anteriores
exports.obterConversaPorId = async (req, res) => {
    try {
        const conversa = await Chat.findById(req.params.id);
        if (!conversa) {
            return res.status(404).json({ error: "Conversa não encontrada." });
        }
        return res.json(conversa);
    } catch (error) {
        console.error("Erro ao carregar histórico:", error.message);
        return res.status(500).json({ error: "Erro ao buscar histórico da conversa." });
    }
};

// 4. Excluir uma conversa do MongoDB
exports.excluirConversa = async (req, res) => {
    try {
        const chatExcluido = await Chat.findByIdAndDelete(req.params.id);
        if (!chatExcluido) {
            return res.status(404).json({ error: "Conversa não encontrada para exclusão." });
        }
        return res.json({ success: true, message: "Conversa excluída com sucesso." });
    } catch (error) {
        console.error("Erro ao excluir conversa:", error.message);
        return res.status(500).json({ error: "Erro ao excluir conversa do banco." });
    }
};