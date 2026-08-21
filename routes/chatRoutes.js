const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const Post = require('../models/Post');

// --- ROTA PRINCIPAL DO CHAT IA (POST /api/chat) ---
router.post('/chat', chatController.enviarMensagem);

// --- ROTAS DO FÓRUM (RAG BASE) ---

// 1. Listar todas as postagens (com ordenação decrescente)
router.get('/posts', async (req, res) => {
    try {
        const { filtro } = req.query;
        let query = {};

        if (filtro === 'resolvido') {
            query.statusResolvido = true;
        }

        const posts = await Post.find(query).sort({ createdAt: -1 });
        return res.json(posts);
    } catch (error) {
        console.error("Erro ao listar posts:", error.message);
        return res.status(500).json({ error: "Erro ao carregar postagens do banco de dados." });
    }
});

// 2. Criar nova dúvida / postagem no fórum
router.post('/posts', async (req, res) => {
    try {
        const { titulo, desc, tags, author } = req.body;

        if (!titulo || !desc) {
            return res.status(400).json({ error: "Título e descrição são obrigatórios." });
        }

        const novoPost = new Post({
            titulo: titulo.trim(),
            desc: desc.trim(),
            tags: Array.isArray(tags) ? tags : ["RAG", "Geral"],
            author: author || "Aluno PFC Logado",
            votos: 0,
            statusResolvido: false
        });

        await novoPost.save();
        return res.status(201).json(novoPost);
    } catch (error) {
        console.error("Erro ao criar post:", error.message);
        return res.status(500).json({ error: "Falha ao salvar no banco de dados." });
    }
});

// 3. Computar voto positivo em um post (PATCH atômico)
router.patch('/posts/:id/vote', async (req, res) => {
    try {
        const postAtualizado = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { votos: 1 } },
            { new: true }
        );

        if (!postAtualizado) {
            return res.status(404).json({ error: "Postagem não encontrada." });
        }

        return res.json(postAtualizado);
    } catch (error) {
        console.error("Erro ao computar voto:", error.message);
        return res.status(500).json({ error: "Não foi possível registrar o voto." });
    }
});

module.exports = router;