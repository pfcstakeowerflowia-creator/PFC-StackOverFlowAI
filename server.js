require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(bodyParser.json());

// --- Conexão MongoDB Atlas ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
    .catch(err => console.error("❌ Erro ao conectar ao Mongo:", err));

// --- Esquema do Fórum (Schema) ---
const PostSchema = new mongoose.Schema({
    titulo: String,
    desc: String,
    tags: [String],
    votos: { type: Number, default: 0 },
    author: { type: String, default: "Aluno PFC" },
    statusResolvido: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', PostSchema);

// --- Configuração IA Gemini ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// ROTAS DO FÓRUM
// ==========================================

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const novoPost = new Post(req.body);
        await novoPost.save();
        res.status(201).json(novoPost);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.patch('/api/posts/:id/vote', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post) {
            post.votos += 1;
            await post.save();
            return res.json({ votos: post.votos });
        }
        res.status(404).json({ message: "Post não encontrado" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ROTA DA IA (CHAT + RAG)
// ==========================================

app.post('/api/chat', async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem;
        console.log("🗣️ Usuário perguntou:", msgUsuario);

        // 1. RAG: Busca no MongoDB posts relacionados à pergunta
        const palavrasChave = msgUsuario.split(" ").filter(p => p.length > 3);
        const contextoDb = await Post.find({
            $or: [
                { titulo: { $regex: palavrasChave.join("|"), $options: "i" } },
                { desc: { $regex: palavrasChave.join("|"), $options: "i" } }
            ]
        }).limit(3);

        // 2. Monta o Contexto do Fórum
        let textoContexto = "Sem contexto local encontrado.";
        if (contextoDb.length > 0) {
            textoContexto = contextoDb.map(p => `Título: ${p.titulo} \nSolução: ${p.desc}`).join("\n\n");
        }

        // 3. Engenharia de Prompt
        const prompt = `Você é o Overflowia Assistant. Seja sempre educado.
        Responda a dúvida do usuário usando o contexto do nosso fórum local (RAG) se for útil. 
        Se houver código, envolva-o em blocos HTML: <div class="code-block"><pre><code>...</code></pre></div>.
        
        [CONTEXTO DO FÓRUM LOCAL]:
        ${textoContexto}
        
        [PERGUNTA DO USUÁRIO]:
        ${msgUsuario}`;

        // 4. Chama a IA
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const respostaFinal = result.response.text();

        console.log("🤖 IA respondeu com sucesso!");
        res.json({ resposta: respostaFinal });

    } catch (error) {
        console.error("❌ Erro na IA:", error);
        res.status(500).json({ resposta: "Erro interno: A IA está offline ou a chave API é inválida." });
    }
});

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor Overflowia Backend rodando na porta ${PORT}`);
});