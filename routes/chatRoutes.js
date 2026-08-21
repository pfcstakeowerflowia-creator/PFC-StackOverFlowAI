const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const Post = require('../models/Post');

// =================================================================
// 1. ROTAS DO CHAT INTELIGENTE E HISTÓRICO NO MONGODB ATLAS
// =================================================================

// Enviar mensagem, consultar RAG e salvar no histórico
router.post('/chat', chatController.enviarMensagem);

// Listar todas as conversas salvas (para a barra lateral)
router.get('/chats', chatController.listarConversas);

// Obter histórico de mensagens de uma conversa específica
router.get('/chats/:id', chatController.obterConversaPorId);

// Excluir uma conversa do banco de dados
router.delete('/chats/:id', chatController.excluirConversa);


// =================================================================
// 2. ROTAS DO FÓRUM COMUNITÁRIO (BASE DE CONHECIMENTO RAG)
// =================================================================

// Listar dúvidas do fórum com suporte a filtros e ordenação
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
        console.error("Erro ao listar postagens:", error.message);
        return res.status(500).json({ error: "Erro ao buscar postagens do banco de dados." });
    }
});

// Publicar uma nova dúvida no fórum
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
        return res.status(500).json({ error: "Falha ao salvar a dúvida no banco de dados." });
    }
});

// Votação atômica em um post (PATCH com $inc)
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
        return res.status(500).json({ error: "Não foi possível computar o voto." });
    }
});

module.exports = router;