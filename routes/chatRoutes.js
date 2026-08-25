const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const Post = require('../models/Post');

// =================================================================
// 1. ROTAS DO CHAT E HISTÓRICO MONGODB
// =================================================================
router.post('/chat', chatController.enviarMensagem);
router.get('/chats', chatController.listarConversas);
router.get('/chats/:id', chatController.obterConversaPorId);
router.delete('/chats/:id', chatController.excluirConversa);

// =================================================================
// 2. ROTAS DO FÓRUM (RAG BASE)
// =================================================================

// Listar dúvidas com filtros
router.get('/posts', async (req, res) => {
    try {
        const { filtro } = req.query;
        let query = {};
        if (filtro === 'resolvido') query.statusResolvido = true;

        const posts = await Post.find(query).sort({ createdAt: -1 });
        return res.json(posts);
    } catch (error) {
        console.error("Erro ao listar postagens:", error.message);
        return res.status(500).json({ error: "Erro ao buscar postagens do banco de dados." });
    }
});

// Publicar nova dúvida
router.post('/posts', async (req, res) => {
    try {
        const { titulo, desc, tags, author } = req.body;
        if (!titulo || !desc) {
            return res.status(400).json({ error: "Título e descrição são campos obrigatórios." });
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
        console.error("Erro ao criar postagem:", error.message);
        return res.status(500).json({ error: "Falha ao salvar no banco de dados." });
    }
});

// Votar em post (PATCH atômico)
router.patch('/posts/:id/vote', async (req, res) => {
    try {
        const postAtualizado = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { votos: 1 } },
            { new: true }
        );
        if (!postAtualizado) return res.status(404).json({ error: "Postagem não encontrada." });
        return res.json(postAtualizado);
    } catch (error) {
        return res.status(500).json({ error: "Não foi possível computar o voto." });
    }
});

// 🗑️ EXCLUIR POSTAGEM DO FÓRUM (NOVA ROTA)
router.delete('/posts/:id', async (req, res) => {
    try {
        const postExcluido = await Post.findByIdAndDelete(req.params.id);
        if (!postExcluido) {
            return res.status(404).json({ error: "Postagem não encontrada para exclusão." });
        }
        return res.json({ success: true, message: "Postagem excluída com sucesso do fórum e da base RAG." });
    } catch (error) {
        console.error("Erro ao excluir postagem:", error.message);
        return res.status(500).json({ error: "Erro ao excluir postagem do banco de dados." });
    }
});

module.exports = router;