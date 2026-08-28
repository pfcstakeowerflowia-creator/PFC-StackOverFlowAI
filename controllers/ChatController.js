const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");
const Chat = require("../models/Chat");

// 1. Enviar Mensagem, Consultar RAG no Fórum e Salvar Interação no MongoDB
exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem || "";
        const arquivoUsuario = req.body.arquivo;
        let chatId = req.body.chatId;

        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || "";
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) {
            return res.json({
                resposta: "⚠️ **Chave de API não configurada:** Adicione a variável `GEMINI_API_KEY` ao arquivo `.env` ou às variáveis de ambiente do Render."
            });
        }

        // --- ETAPA 1: RAG Semântico (Consulta de Tópicos no MongoDB Atlas) ---
        let contextoDb = [];
        try {
            if (msgUsuario.trim().length > 0) {
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
            console.warn("⚠️ Aviso RAG:", dbErr.message);
        }

        let textoContexto = "Nenhum post relevante encontrado no fórum local.";
        if (contextoDb.length > 0) {
            textoContexto = contextoDb.map(p => {
                let solucaoTexto = p.desc;
                const melhorResp = Array.isArray(p.respostas) ? p.respostas.find(r => r.isMelhorResposta) : null;
                if (melhorResp) {
                    solucaoTexto += `\n  [SOLUÇÃO APROVADA DA COMUNIDADE]: ${melhorResp.texto}`;
                } else if (p.respostas && p.respostas.length > 0) {
                    solucaoTexto += `\n  [RESPOSTA DA COMUNIDADE]: ${p.respostas[0].texto}`;
                }
                return `• [Tópico Fórum]: "${p.titulo}" (Status: ${p.statusResolvido ? 'Resolvido' : 'Em aberto'})\n  Conteúdo: ${solucaoTexto}`;
            }).join("\n\n");
        }

        // --- ETAPA 2: Engenharia de Prompt Especializado ---
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

        // Anexo Multimodal (Imagem, PDF ou Arquivo de Código em Base64)
        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        // --- ETAPA 3: Fallback em Cascata de Modelos Gemini ---
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
                console.warn(`⚠️ Modelo ${nomeModelo} falhou. Tentando próximo da cascata...`);
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
            chatDoc = await Chat.findById(chatId);
            if (chatDoc) {
                chatDoc.messages.push(dadosMsgUsuario);
                chatDoc.messages.push(dadosMsgIA);
                chatDoc.updatedAt = new Date();
                await chatDoc.save();
            }
        }

        if (!chatDoc) {
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

        return res.json({
            resposta: respostaTexto,
            chatId: chatDoc._id,
            title: chatDoc.title
        });

    } catch (error) {
        console.error("❌ Erro no chatController:", error.message);
        return res.json({
            resposta: `⚠️ **Falha no processamento da IA:**\n\n\`${error.message}\``
        });
    }
};

// 2. Listar Conversas Salvas para a Sidebar
exports.listarConversas = async (req, res) => {
    try {
        const conversas = await Chat.find({}, '_id title updatedAt createdAt')
            .sort({ updatedAt: -1 })
            .limit(25);
        return res.json(conversas);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao listar conversas." });
    }
};

// 3. Obter Mensagens de uma Conversa Específica
exports.obterConversaPorId = async (req, res) => {
    try {
        const conversa = await Chat.findById(req.params.id);
        if (!conversa) {
            return res.status(404).json({ error: "Conversa não encontrada." });
        }
        return res.json(conversa);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar histórico." });
    }
};

// 4. Excluir Conversa do Banco de Dados
exports.excluirConversa = async (req, res) => {
    try {
        await Chat.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: "Conversa excluída com sucesso." });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao excluir conversa." });
    }
};