const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");
const Chat = require("../models/Chat");

// ====================================================================
// FUNÇÕES AUXILIARES DO RAG AVANÇADO COM MEMÓRIA
// ====================================================================

// 1. Gerar vetor semântico (768 dimensões)
async function gerarEmbedding(texto, genAI) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(texto);
        return result.embedding.values;
    } catch (err) {
        console.warn("⚠️ Falha ao gerar embedding (usando fallback léxico):", err.message);
        return null;
    }
}

// 2. Expansão de Consulta com Consciência de Contexto (Context-Aware Query Rewriter)
async function otimizarPergunta(perguntaUsuario, contextoAnterior, genAI) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Você é um otimizador de busca para um fórum técnico de programação.
Resumo do último assunto conversado (se houver): "${contextoAnterior}"
Pergunta atual do estudante: "${perguntaUsuario}"

INSTRUÇÃO:
Se a pergunta atual for dependente do contexto (ex: "me explique melhor sobre isso", "como corrijo esse erro?", "e no python?"), use o resumo do assunto anterior para identificar sobre qual tecnologia/conceito o aluno está perguntando.
Retorne APENAS uma linha com os termos técnicos essenciais e sinônimos para a busca. Sem explicações ou pontuação.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        return perguntaUsuario; // Fallback se a chamada rápida falhar
    }
}

// 3. Motor de Busca Híbrida + Reranking Ponderado
async function buscarContextoHibrido(perguntaUsuario, contextoAnterior, genAI) {
    let resultadosVetoriais = [];
    let resultadosLexicos = [];

    // Passo A: Expansão inteligente da dúvida (considerando o histórico)
    const queryExpandida = await otimizarPergunta(perguntaUsuario, contextoAnterior, genAI);
    console.log(`🔍 [RAG Expansion] De: "${perguntaUsuario}" -> Para: "${queryExpandida}"`);

    // Passo B: Busca Vetorial Semântica no MongoDB Atlas
    const vetorPergunta = await gerarEmbedding(queryExpandida, genAI);
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

    // Passo C: Busca Léxica com Índice Textual ($text)
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

    // Passo D: Reranking e Fusão Ponderada (RRF + Bônus Comunitário)
    const mapaScore = new Map();

    const processarPost = (p, scoreBase, tipo) => {
        const id = p._id.toString();
        const bonusResolvido = p.statusResolvido ? 1.5 : 1.0; // +50% se tem solução aprovada
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
// CONTROLLER PRINCIPAL COM MEMÓRIA MULTI-TURN
// ====================================================================
exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem || "";
        const arquivoUsuario = req.body.arquivo;
        let chatId = req.body.chatId;

        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || "";
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) {
            return res.json({
                resposta: "⚠️ **Chave de API não configurada:** Adicione a variável `GEMINI_API_KEY` ao arquivo `.env`."
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // =================================================================
        // ETAPA 1: RESGATAR HISTÓRICO DA CONVERSA NO MONGODB ATLAS
        // =================================================================
        let chatDoc = null;
        let historicoGemini = [];
        let contextoConversaRecente = "";

        if (chatId) {
            chatDoc = await Chat.findById(chatId);
            if (chatDoc && Array.isArray(chatDoc.messages) && chatDoc.messages.length > 0) {
                // Pega as últimas mensagens para manter contexto recente (evita estourar tokens)
                const msgsRecentes = chatDoc.messages.slice(-8);

                // Isola o último assunto falado pela IA para o RAG entender pronomes como "isso"
                const ultimasIA = chatDoc.messages.filter(m => m.sender === 'ai');
                if (ultimasIA.length > 0) {
                    contextoConversaRecente = ultimasIA[ultimasIA.length - 1].text.substring(0, 250);
                }

                // Formata o histórico no padrão aceito pelo Gemini ({ role: 'user' | 'model', parts })
                for (const m of msgsRecentes) {
                    historicoGemini.push({
                        role: m.sender === 'user' ? 'user' : 'model',
                        parts: [{ text: m.text || " " }]
                    });
                }

                // O histórico do Gemini precisa obrigatoriamente iniciar com uma mensagem 'user'
                while (historicoGemini.length > 0 && historicoGemini[0].role !== 'user') {
                    historicoGemini.shift();
                }
            }
        }

        // =================================================================
        // ETAPA 2: RECUPERAÇÃO RAG HÍBRIDA (COM MEMÓRIA DE ASSUNTO)
        // =================================================================
        let contextoDb = [];
        if (msgUsuario.trim().length > 0) {
            contextoDb = await buscarContextoHibrido(msgUsuario, contextoConversaRecente, genAI);
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

        // =================================================================
        // ETAPA 3: DIRETRIZES DE SISTEMA & ANCORAGEM
        // =================================================================
        const systemInstruction = `Você é o Overflowia.AI, assistente inteligente oficial integrado à base comunitária de programação do IFPR.

DIRETRIZES FUNDAMENTAIS:
1. Mantenha a coerência com as mensagens anteriores da conversa. O estudante pode fazer perguntas de continuidade (ex: "me explique melhor sobre isso", "e como faço em Python?"). Entenda a que assunto anterior ele está se referindo.
2. Analise o [CONTEXTO DO FÓRUM LOCAL]. Se houver tópicos relevantes, cite-os expressamente (ex: "No fórum da nossa comunidade temos um tópico resolvido sobre '[Título]'...").
3. Priorize soluções marcadas com [SOLUÇÃO VALIDADA PELA COMUNIDADE].
4. Se o contexto for vazio ou insuficiente, use seu próprio conhecimento técnico para explicar com clareza, didática e profundidade.
5. Sempre forneça códigos funcionais completos em blocos Markdown com a linguagem especificada (ex: \`\`\`javascript, \`\`\`html, \`\`\`css).

[CONTEXTO DO FÓRUM LOCAL]:
${textoContexto}`;

        const promptPrincipal = msgUsuario || "Analise o arquivo anexado e apresente a solução técnica.";
        const parts = [promptPrincipal];

        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        // =================================================================
        // ETAPA 4: GERAÇÃO MULTI-TURN COM GEMINI (SESSÃO DE CHAT ATIVA)
        // =================================================================
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

                // Inicia o chat com o histórico prévio de mensagens!
                const chatSession = model.startChat({
                    history: historicoGemini
                });

                const result = await chatSession.sendMessage(parts);
                const response = await result.response;
                respostaTexto = response.text();

                if (respostaTexto) {
                    console.log(`✅ [Memória Ativa] Resposta gerada via ${nomeModelo}. Histórico carregado: ${historicoGemini.length} msgs.`);
                    break;
                }
            } catch (errModelo) {
                erroUltimo = errModelo;
                console.warn(`⚠️ Modelo ${nomeModelo} falhou na sessão de chat:`, errModelo.message);
            }
        }

        if (!respostaTexto) {
            throw erroUltimo || new Error("Falha ao comunicar com os modelos de IA.");
        }

        // =================================================================
        // ETAPA 5: PERSISTÊNCIA DA CONVERSA NO MONGODB ATLAS
        // =================================================================
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
                title: tituloSintetico,
                author: "Aluno PFC Logado",
                messages: [dadosMsgUsuario, dadosMsgIA]
            });
            await chatDoc.save();
        }

        return res.json({
            resposta: respostaTexto,
            chatId: chatDoc._id,
            title: chatDoc.title,
            fontesConsultadas: fontesConsultadas
        });

    } catch (error) {
        console.error("❌ Erro no chatController:", error.message);
        return res.status(500).json({
            resposta: `⚠️ **Falha no processamento da IA:**\n\n\`${error.message}\``
        });
    }
};

// Listar Conversas
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

// Obter Conversa por ID
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

// Excluir Conversa
exports.excluirConversa = async (req, res) => {
    try {
        await Chat.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: "Conversa excluída com sucesso." });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao excluir conversa." });
    }
};