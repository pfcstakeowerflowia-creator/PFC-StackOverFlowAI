const { GoogleGenAI } = require("@google/genai");
const Post = require("../models/Post");

// Inicializa a nova biblioteca com a sua chave
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem;
        const arquivoUsuario = req.body.arquivo; 

        // 1. RAG: Busca no MongoDB posts relacionados
        const palavrasChave = msgUsuario ? msgUsuario.split(" ").filter(p => p.length > 3) : [];
        let contextoDb = [];
        
        if (palavrasChave.length > 0) {
            contextoDb = await Post.find({
                $or: [
                    { titulo: { $regex: palavrasChave.join("|"), $options: "i" } },
                    { desc: { $regex: palavrasChave.join("|"), $options: "i" } }
                ]
            }).limit(3);
        }

        let textoContexto = contextoDb.length > 0 
            ? contextoDb.map(p => `Título: ${p.titulo} \nSolução: ${p.desc}`).join("\n\n")
            : "Nenhum post relevante encontrado no fórum local.";

        const prompt = `[CONTEXTO DO FÓRUM LOCAL]:\n${textoContexto}\n\n[PERGUNTA DO USUÁRIO]:\n${msgUsuario || "(O usuário enviou uma imagem/mídia para análise sem uma pergunta textual adicional.)"}`;

        // Prepara as partes do prompt (suporta imagens/arquivos)
        const parts = [prompt];

        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        // 2. Chama a IA usando o novo formato @google/genai
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash', 
            contents: parts,
            config: {
                systemInstruction: `Você é o Overflowia Assistant, um assistente de Inteligência Artificial educado, profissional e prestativo, criado para ajudar estudantes e desenvolvedores.
                
                Regras:
                - Responda de forma clara, direta e amigável.
                - Se encontrar algo no [CONTEXTO LOCAL], use essa informação para responder e cite que você encontrou a resposta no banco de dados da comunidade.
                - Se o usuário anexar um arquivo, utilize-o para fundamentar sua análise.
                
                🔥 REGRAS RÍGIDAS SOBRE CÓDIGO 🔥
                - NUNCA envie blocos de código, exemplos de código ou scripts, a menos que o usuário PEÇA EXPLICITAMENTE (ex: "me dê o código", "como programo isso", "faça um exemplo em HTML").
                - Se o usuário fizer uma pergunta teórica (ex: "o que é flexbox?"), responda APENAS com texto, explicações e analogias, sem escrever linhas de código.
                - SE, e SOMENTE SE, o usuário pedir código, você DEVE envolver o código nesta estrutura exata de HTML para renderizar bonito no site:
                <div class="code-block"><div class="code-header"><span>Código</span></div><pre><code>...seu código aqui...</code></pre></div>`
            }
        });

        res.json({ resposta: response.text });

    } catch (error) {
        console.error("❌ Erro na IA:", error.message);
        res.status(500).json({ resposta: " O servidor deu erro: " + error.message });
    }
};