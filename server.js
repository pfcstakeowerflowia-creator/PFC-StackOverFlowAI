require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(cors());
app.use(bodyParser.json());

// --- CONEXÃO MONGO DB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
    .catch(err => console.error("❌ Erro ao conectar ao Mongo:", err));

// --- MODELO DE DADOS (SCHEMA) ---
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

// --- CONFIG IA ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- ENDPOINTS DO FÓRUM ---

// Buscar todas as perguntas do Banco
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Salvar nova pergunta no Banco
app.post('/api/posts', async (req, res) => {
    try {
        const novoPost = new Post(req.body);
        await novoPost.save();
        res.status(201).json(novoPost);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Votação (Update no Banco)
app.patch('/api/posts/:id/vote', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post) {
            post.votos += 1;
            await post.save();
            return res.json({ votos: post.votos });
        }
        res.status(404).json({ message: "Não encontrado" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT CHAT IA COM RAG REAL ---
app.post('/api/chat', async (req, res) => {
    try {
        const msgUsuario = req.body.mensagem;

        // RAG: Busca no MongoDB posts que combinam com a pergunta
        const palavrasChave = msgUsuario.split(" ").filter(p => p.length > 3);
        const contextoDb = await Post.find({
            $or: [
                { titulo: { $regex: palavrasChave.join("|"), $options: "i" } },
                { desc: { $regex: palavrasChave.join("|"), $options: "i" } }
            ]
        }).limit(3);

        const textoContexto = contextoDb.map(p => `Post: ${p.titulo} - Resumo: ${p.desc}`).join("\n");

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Você é o Overflowia AI. Use o contexto do fórum abaixo se for útil.\n\nContexto:\n${textoContexto}\n\nPergunta:\n${msgUsuario}`;

        const result = await model.generateContent(prompt);
        res.json({ resposta: result.response.text() });
    } catch (error) {
        res.status(500).json({ resposta: "Erro ao processar IA" });
    }
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));