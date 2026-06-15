const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController'); // Ajuste o caminho se a sua pasta de controllers for diferente
const Post = require('../models/Post'); // Importa o modelo do MongoDB para as postagens do fórum

// Rota para o Chat: POST /api/chat
router.post('/chat', chatController.enviarMensagem);

// Rota para listar posts: GET /api/posts
router.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para criar um post: POST /api/posts
router.post('/posts', async (req, res) => {
    try {
        const novoPost = new Post(req.body);
        await novoPost.save();
        res.status(201).json(novoPost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para computar votos: PATCH /api/posts/:id/vote
router.patch('/posts/:id/vote', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Post não encontrado" });
        
        post.votos += 1;
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;