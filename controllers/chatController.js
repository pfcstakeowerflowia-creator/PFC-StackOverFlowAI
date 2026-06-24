const { GoogleGenerativeAI } = require("@google/generative-ai");
const Post = require("../models/Post");

exports.enviarMensagem = async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem;
        const arquivoUsuario = req.body.arquivo; 

        // Verifica se a API Key está configurada no servidor
        if (!process.env.GEMINI_API_KEY) {
            console.error("❌ Erro: A variável de ambiente GEMINI_API_KEY não foi configurada.");
            return res.status(500).json({ 
                resposta: "Erro de Configuração: A variável de ambiente GEMINI_API_KEY não está configurada no servidor de hospedagem (Render). Configure-a nas configurações de ambiente do painel." 
            });
        }

        // Inicializa a biblioteca clássica com a sua chave dentro do handler para evitar crashes na inicialização
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        
        // 2. Configura o Modelo com a Personalidade e o modelo atualizado (gemini-2.5-flash)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", // Modelo atualizado e ativo em produção
             systemInstruction: `Você é um assistente de inteligência artificial direto, prestativo e profissional para um fórum de programação.
            Regras:
            - Seja direto, claro e forneça respostas úteis e corretas.
            - Sempre que houver código na resposta, use formatação Markdown padrão (como blocos de código com a respectiva linguagem).
            - Utilize as informações do [CONTEXTO DO FÓRUM LOCAL] se elas forem úteis para resolver a questão do usuário.
            - Caso o usuário forneça imagens ou arquivos, analise-los com precisão e relate diretamente suas conclusões.`
        });



        // 3. Executa a chamada à API do Gemini
        const result = await model.generateContent(parts);
        const response = await result.response;
        
        res.json({ resposta: response.text() });

    } catch (error) {
        console.error("❌ Erro na IA:", error.message);
        res.status(500).json({ resposta: "O servidor deu erro: " + error.message });
    }
};