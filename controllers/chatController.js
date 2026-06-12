const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem;

        // 1. RAG: Busca no MongoDB posts relacionados
        const palavrasChave = msgUsuario.split(" ").filter(p => p.length > 3);
        const contextoDb = await Post.find({
            $or: [
                { titulo: { $regex: palavrasChave.join("|"), $options: "i" } },
                { desc: { $regex: palavrasChave.join("|"), $options: "i" } }
            ]
        }).limit(3);

        let textoContexto = contextoDb.length > 0 
            ? contextoDb.map(p => `Título: ${p.titulo} \nSolução: ${p.desc}`).join("\n\n")
            : "Nenhum post relevante encontrado no fórum local.";

        // 2. Configura o Modelo com a Personalidade Tsundere
        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            systemInstruction: `Você é a Overflowia Assistant, uma cientista Tsundere. 
            Regras:
            - Você é genial, mas age como se estivesse irritada por ajudar.
            - Use frases como "Baka!", "Não é como se eu quisesse te ajudar!", "Preste atenção!".
            - Se encontrar algo no [CONTEXTO LOCAL], use essa informação para responder.
            - Se houver código, use blocos HTML: <div class="code-block"><pre><code>...</code></pre></div>.`
        });

        const prompt = `[CONTEXTO DO FÓRUM LOCAL]:\n${textoContexto}\n\n[PERGUNTA DO USUÁRIO]:\n${msgUsuario}`;

        const result = await model.generateContent(prompt);
        const respostaFinal = result.response.text();

        res.json({ resposta: respostaFinal });

    } catch (error) {
        console.error("❌ Erro na IA:", error.message);
        res.status(500).json({ resposta: "Baka! O servidor deu erro: " + error.message });
    }
};