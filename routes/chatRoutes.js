const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const Post = require('../models/Post'); // Import direto para rotas simples de post

// Rota da IA
router.post('/chat', chatController.enviarMensagem);

// Rotas do Fórum (Simplificadas para o exemplo)
router.get('/posts', async (req, res) => {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
});

router.post('/posts', async (req, res) => {
    const novoPost = new Post(req.body);
    await novoPost.save();
    res.status(201).json(novoPost);
});

module.exports = router;