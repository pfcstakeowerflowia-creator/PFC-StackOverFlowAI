const mongoose = require("mongoose");
const Post = require("../models/Post");
const Chat = require("../models/Chat");

// Carregador dinâmico do SDK @google/genai (compatível com ESM + top-level await no Node 24)
let _GoogleGenAI = null;
async function criarClienteGenAI(apiKey) {
    if (!_GoogleGenAI) {
        const modulo = await import("@google/genai");
        _GoogleGenAI = modulo.GoogleGenAI;
    }
    return new _GoogleGenAI({ apiKey });
}

// ====================================================================
// FUNÇÕES AUXILIARES DO RAG AVANÇADO (SDK @google/genai + GEMINI 3.8 / 4)
// ====================================================================

// 1. Gerar vetor semântico (768 dimensões) com o Gemini Embedding 2
async function gerarEmbedding(texto, ai) {
    try {
        const result = await ai.models.embedContent({
            model: "gemini-embedding-2",
            contents: `Busca técnica em fórum de programação: ${texto}`,
            config: {
                outputDimensionality: 768
            }
        });
        return result.embeddings?.[0]?.values || null;
    } catch (err) {
        console.warn("⚠️ Falha ao gerar embedding (usando fallback léxico):", err.message);
        return null;
    }
}

// 2. Expansão de Consulta com modelo ultrarrápido (Gemini 3.5 Flash-Lite)
async function otimizarPergunta(perguntaUsuario, contextoAnterior, ai) {
    try {
        const prompt = `Você é um otimizador de busca para um fórum técnico de programação.
Resumo do último assunto conversado (se houver): "${contextoAnterior}"
Pergunta atual do estudante: "${perguntaUsuario}"

INSTRUÇÃO:
Se a pergunta atual for dependente do contexto (ex: "me explique melhor sobre isso", "como corrijo esse erro?", "e no python?"), use o resumo do assunto anterior para identificar sobre qual tecnologia/conceito o aluno está perguntando.
Retorne APENAS uma linha com os termos técnicos essenciais e sinônimos para a busca. Sem explicações ou pontuação.`;

        const result = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: prompt
        });
        return result.text ? result.text.trim() : perguntaUsuario;
    } catch (e) {
        return perguntaUsuario;
    }
}

// 3. Motor de Busca Híbrida + Reranking Ponderado
async function buscarContextoHibrido(perguntaUsuario, contextoAnterior, ai) {
    let resultadosVetoriais = [];
    let resultadosLexicos = [];

    const queryExpandida = await otimizarPergunta(perguntaUsuario, contextoAnterior, ai);
    console.log(`🔍 [RAG Expansion] De: "${perguntaUsuario}" -> Para: "${queryExpandida}"`);

    const vetorPergunta = await gerarEmbedding(queryExpandida, ai);
    if (vetorPergunta) {
        try {
            resultadosVetoriais = await Post.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index_posts",
                        path: "embedding",
                        queryVector: vetorPergunta,
                        numCandidates: 15,
                        limit: 4
                    }
                },
                {
                    $project: {
                        titulo: 1, desc: 1, tags: 1, author: 1, statusResolvido: 1, votos: 1, respostas: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ]);
        } catch (errVector) {
            console.warn("⚠️ Atlas Vector Search em fallback léxico.");
        }
    }

    try {
        resultadosLexicos = await Post.find(
            { $text: { $search: queryExpandida } },
            { score: { $meta: "textScore" } }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(4);
    } catch (errText) {
        console.warn("⚠️ Busca $text falhou:", errText.message);
    }

    const mapaScore = new Map();

    const processarPost = (p, scoreBase, tipo) => {
        const id = p._id.toString();
        const bonusResolvido = p.statusResolvido ? 1.5 : 1.0;
        const bonusVotos = 1 + Math.log10((p.votos || 0) + 1) * 0.2;
        const scoreFinal = scoreBase * bonusResolvido * bonusVotos;

        if (mapaScore.has(id)) {
            const existente = mapaScore.get(id);
            existente.scoreFinal += scoreFinal;
        } else {
            const obj = p.toObject ? p.toObject() : p;
            mapaScore.set(id, { ...obj, scoreFinal, tipoOrigem: tipo });
        }
    };

    resultadosVetoriais.forEach(p => processarPost(p, (p.score || 0.7) * 1.2, 'vetorial'));
    resultadosLexicos.forEach(p => processarPost(p, 0.8, 'lexica'));

    return Array.from(mapaScore.values())
        .sort((a, b) => b.scoreFinal - a.scoreFinal)
        .slice(0, 3);
}

// ====================================================================
// 1. ENVIAR MENSAGEM, CONSULTAR RAG E SALVAR NA CONTA DO USUÁRIO
// ====================================================================
exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem || "";
        const arquivoUsuario = req.body.arquivo;
        const chatId = req.body.chatId;
        const userId = req.body.userId;
        const userName = req.body.userName || "Aluno PFC";

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({
                resposta: "⚠️ **Sessão não identificada:** Saia e faça login novamente para vincular o chat à sua conta."
            });
        }

        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || "";
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) {
            return res.json({
                resposta: "⚠️ **Chave de API não configurada:** Adicione a variável `GEMINI_API_KEY` ao arquivo `.env`."
            });
        }

        // Instancia o SDK via import dinâmico
        const ai = await criarClienteGenAI(apiKey);

        // --- ETAPA 1: RESGATAR HISTÓRICO EXCLUSIVO DA CONTA ---
        let chatDoc = null;
        let historicoGemini = [];
        let contextoConversaRecente = "";

        if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
            chatDoc = await Chat.findOne({ _id: chatId, userId: userId });

            if (chatDoc && Array.isArray(chatDoc.messages) && chatDoc.messages.length > 0) {
                const msgsRecentes = chatDoc.messages.slice(-8);

                const ultimasIA = chatDoc.messages.filter(m => m.sender === 'ai');
                if (ultimasIA.length > 0) {
                    contextoConversaRecente = ultimasIA[ultimasIA.length - 1].text.substring(0, 250);
                }

                for (const m of msgsRecentes) {
                    historicoGemini.push({
                        role: m.sender === 'user' ? 'user' : 'model',
                        parts: [{ text: m.text || " " }]
                    });
                }

                while (historicoGemini.length > 0 && historicoGemini[0].role !== 'user') {
                    historicoGemini.shift();
                }
            }
        }

        // --- ETAPA 2: RECUPERAÇÃO RAG HÍBRIDA ---
        let contextoDb = [];
        if (msgUsuario.trim().length > 0) {
            contextoDb = await buscarContextoHibrido(msgUsuario, contextoConversaRecente, ai);
        }

        let textoContexto = "Nenhum tópico idêntico ou relevante encontrado no fórum local até o momento.";
        let fontesConsultadas = [];

        if (contextoDb && contextoDb.length > 0) {
            fontesConsultadas = contextoDb.map(p => ({
                id: p._id,
                titulo: p.titulo,
                author: p.author || "Aluno da Comunidade",
                statusResolvido: p.statusResolvido,
                score: Math.round((p.scoreFinal || 1) * 10) / 10
            }));

            textoContexto = contextoDb.map((p, idx) => {
                let conteudoPost = p.desc;
                const melhorResp = Array.isArray(p.respostas) ? p.respostas.find(r => r.isMelhorResposta) : null;
                
                if (melhorResp) {
                    conteudoPost += `\n    -> [SOLUÇÃO VALIDADA PELA COMUNIDADE]: ${melhorResp.texto}`;
                } else if (p.respostas && p.respostas.length > 0) {
                    conteudoPost += `\n    -> [RESPOSTA DE UM ALUNO]: ${p.respostas[0].texto}`;
                }

                return `[FONTE ${idx + 1}]: Tópico "${p.titulo}" (Status: ${p.statusResolvido ? 'Resolvido ✓' : 'Em aberto'})
Conteúdo: ${conteudoPost}`;
            }).join("\n\n");
        }

        // --- ETAPA 3: DIRETRIZES DE SISTEMA ---
        const systemInstruction = `Você é o Overflowia.AI, assistente inteligente oficial integrado à base comunitária de programação do IFPR.

DIRETRIZES FUNDAMENTAIS:
1. Mantenha a coerência com as mensagens anteriores da conversa. O estudante pode fazer perguntas de continuidade (ex: "me explique melhor sobre isso", "e como faço em Python?").
2. Analise o [CONTEXTO DO FÓRUM LOCAL]. Se houver tópicos relevantes, cite-os expressamente (ex: "No fórum da nossa comunidade temos um tópico resolvido sobre '[Título]'...").
3. Priorize soluções marcadas com [SOLUÇÃO VALIDADA PELA COMUNIDADE].
4. Se o contexto for vazio ou insuficiente, use seu próprio conhecimento técnico para explicar com clareza, didática e profundidade.
5. Sempre forneça códigos funcionais completos em blocos Markdown com a linguagem especificada.

[CONTEXTO DO FÓRUM LOCAL]:
${textoContexto}`;

        const promptPrincipal = msgUsuario || "Analise o arquivo anexado e apresente a solução técnica.";
        const parts = [{ text: promptPrincipal }];

        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        // --- ETAPA 4: CASCATA COM OS MODELOS MAIS ATUAIS ---
        const modelos = [
            "gemini-3.8-flash",
            "gemini-4-argon",
            "gemini-4-carbon",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite"
        ];

        let respostaTexto = null;
        let modeloUsado = null;
        let erroUltimo = null;

        for (const nomeModelo of modelos) {
            try {
                const chatSession = ai.chats.create({
                    model: nomeModelo,
                    config: {
                        systemInstruction: systemInstruction,
                        temperature: 0.7
                    },
                    history: historicoGemini
                });

                const result = await chatSession.sendMessage({
                    message: parts
                });

                respostaTexto = result.text;

                if (respostaTexto) {
                    modeloUsado = nomeModelo;
                    console.log(`✅ [Conta: ${userName}] Resposta via ${nomeModelo}. Histórico: ${historicoGemini.length} msgs.`);
                    break;
                }
            } catch (errModelo) {
                erroUltimo = errModelo;
                console.warn(`⚠️ Modelo ${nomeModelo} falhou:`, errModelo.message);
            }
        }

        if (!respostaTexto) {
            throw erroUltimo || new Error("Falha ao comunicar com os modelos de IA.");
        }

        // --- ETAPA 5: PERSISTÊNCIA DA CONVERSA ---
        const dadosMsgUsuario = {
            sender: 'user',
            text: msgUsuario,
            attachment: arquivoUsuario ? { name: arquivoUsuario.name, mimeType: arquivoUsuario.mimeType } : null
        };
        const dadosMsgIA = {
            sender: 'ai',
            text: respostaTexto
        };

        if (chatDoc) {
            chatDoc.messages.push(dadosMsgUsuario, dadosMsgIA);
            chatDoc.updatedAt = new Date();
            await chatDoc.save();
        } else {
            const tituloSintetico = msgUsuario.length > 35 
                ? msgUsuario.substring(0, 35) + "..." 
                : (msgUsuario || "Dúvida Técnica");

            chatDoc = new Chat({
                userId: userId,
                title: tituloSintetico,
                author: userName,
                messages: [dadosMsgUsuario, dadosMsgIA]
            });
            await chatDoc.save();
        }

        return res.json({
            resposta: respostaTexto,
            chatId: chatDoc._id,
            title: chatDoc.title,
            fontesConsultadas: fontesConsultadas,
            modelo: modeloUsado
        });

    } catch (error) {
        console.error("❌ Erro no chatController:", error.message);
        return res.status(500).json({
            resposta: `⚠️ **Falha no processamento da IA:**\n\n\`${error.message}\``
        });
    }
};

exports.listarConversas = async (req, res) => {
    try {
        const userId = req.query.userId || req.headers['x-user-id'];
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.json([]);
        }
        const conversas = await Chat.find({ userId: userId }, '_id title updatedAt createdAt')
            .sort({ updatedAt: -1 })
            .limit(25);
        return res.json(conversas);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao listar conversas." });
    }
};

exports.obterConversaPorId = async (req, res) => {
    try {
        const userId = req.query.userId || req.headers['x-user-id'];
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({ error: "Acesso não autorizado." });
        }
        const conversa = await Chat.findOne({ _id: req.params.id, userId: userId });
        if (!conversa) {
            return res.status(404).json({ error: "Conversa não encontrada ou acesso negado." });
        }
        return res.json(conversa);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar histórico." });
    }
};

exports.excluirConversa = async (req, res) => {
    try {
        const userId = req.query.userId || req.headers['x-user-id'];
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({ error: "Acesso não autorizado." });
        }
        const deletada = await Chat.findOneAndDelete({ _id: req.params.id, userId: userId });
        if (!deletada) {
            return res.status(404).json({ error: "Conversa não encontrada ou sem permissão." });
        }
        return res.json({ success: true, message: "Conversa excluída com sucesso." });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao excluir conversa." });
    }
};