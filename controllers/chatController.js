const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");

exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem || "";
        const arquivoUsuario = req.body.arquivo;

        // Limpa e valida a chave da API (aceita GEMINI_API_KEY ou API_KEY)
        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || "";
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) {
            console.error("❌ Erro: GEMINI_API_KEY não configurada no .env");
            return res.json({
                resposta: "⚠️ **Erro de Configuração:** A chave `GEMINI_API_KEY` não foi encontrada no arquivo `.env` do servidor."
            });
        }

        // 1. RAG: Busca semântica segura no MongoDB (posts do fórum)
        let contextoDb = [];
        try {
            if (msgUsuario.trim().length > 0) {
                // Remove caracteres especiais para evitar quebrar o regex do Mongo com termos como 'C++', '[]', etc.
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
            console.warn("⚠️ Aviso RAG (busca ignorada):", dbErr.message);
        }

        const textoContexto = contextoDb.length > 0
            ? contextoDb.map(p => `• [Tópico Fórum]: "${p.titulo}"\n  Conteúdo/Solução: ${p.desc}`).join("\n\n")
            : "Nenhum post relevante encontrado no fórum local.";

        // 2. Montagem das instruções do sistema e prompt
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

        // Adiciona arquivo/print multimodal se enviado pelo usuário
        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        // 3. Inicialização com lista de modelos (do mais moderno ao fallback)
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelosParaTentar = [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
        ];

        let respostaTexto = null;
        let erroUltimo = null;

        for (const nomeModelo of modelosParaTentar) {
            try {
                const model = genAI.getGenerativeModel({
                    model: nomeModelo,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        temperature: 0.7
                    }
                });

                const result = await model.generateContent(parts);
                const response = await result.response;
                respostaTexto = response.text();

                if (respostaTexto) {
                    console.log(`✅ Resposta gerada com sucesso via modelo: ${nomeModelo}`);
                    break;
                }
            } catch (errModelo) {
                erroUltimo = errModelo;
                console.warn(`⚠️ Tentativa com ${nomeModelo} falhou (${errModelo.message}). Tentando próximo modelo...`);
            }
        }

        if (respostaTexto) {
            return res.json({ resposta: respostaTexto });
        } else {
            throw erroUltimo || new Error("Nenhum modelo da lista conseguiu responder à solicitação.");
        }

    } catch (error) {
        console.error("❌ Erro no chatController:", error.message);
        return res.json({
            resposta: `⚠️ **Falha no processamento da IA:**\n\n\`${error.message}\`\n\n*Dica: Verifique se sua GEMINI_API_KEY é válida e possui cotas ativas no Google AI Studio.*`
        });
    }
};