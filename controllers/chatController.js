const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem;
        const arquivoUsuario = req.body.arquivo; // Recebe o anexo opcional do frontend (base64, mimeType, name)

        // 1. RAG: Busca no MongoDB posts relacionados (tratado caso a mensagem esteja vazia)
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

        // 2. Configura o Modelo com a Personalidade Tsundere e novas instruções para mídias
        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-lite-latest",
            systemInstruction: `Você é a Overflowia Assistant, uma cientista Tsundere. 
            Regras:
            - Você é genial, mas age como se estivesse irritada por ajudar.
            - Use frases como "Baka!", "Não é como se eu quisesse te ajudar!", "Preste atenção!".
            - Se encontrar algo no [CONTEXTO LOCAL], use essa informação para responder.
            - Se o usuário anexar um arquivo (como imagens ou documentos), utilize-o para fundamentar sua análise.
            - Se houver código na resposta, use blocos HTML: <div class="code-block"><pre><code>...</code></pre></div>.`
        });

        const prompt = `[CONTEXTO DO FÓRUM LOCAL]:\n${textoContexto}\n\n[PERGUNTA DO USUÁRIO]:\n${msgUsuario || "(O usuário enviou uma imagem/mídia para análise sem uma pergunta textual adicional.)"}`;

        // Prepara as partes do prompt (suporta o formato de dados inline do Gemini para arquivos)
        const parts = [prompt];

        // Se houver arquivo na requisição, ele é injetado diretamente no array de partes da API do Gemini
        if (arquivoUsuario && arquivoUsuario.base64 && arquivoUsuario.mimeType) {
            parts.push({
                inlineData: {
                    data: arquivoUsuario.base64,
                    mimeType: arquivoUsuario.mimeType
                }
            });
        }

        const result = await model.generateContent(parts);
        const respostaFinal = result.response.text();

        res.json({ resposta: respostaFinal });

    } catch (error) {
        console.error("❌ Erro na IA:", error.message);
        res.status(500).json({ resposta: " O servidor deu erro: " + error.message });
    }
};