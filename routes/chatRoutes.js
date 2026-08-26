const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const chatController = require('../controllers/chatController');
const Post = require('../models/Post');
const User = require('../models/User');

// =================================================================
// 1. ROTAS DE AUTENTICAÇÃO NO MONGODB ATLAS
// =================================================================

// Criar Nova Conta (Registro)
router.post('/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, role, adminCode } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
        }

        // Verifica se o e-mail já existe no banco
        const usuarioExistente = await User.findOne({ email: email.toLowerCase().trim() });
        if (usuarioExistente) {
            return res.status(400).json({ error: "Este e-mail já está cadastrado no sistema." });
        }

        // Se solicitou conta Admin, valida o código mestre (padrão PFC: 2026)
        let roleFinal = 'aluno';
        if (role === 'admin') {
            if (adminCode === 'admin2026' || adminCode === 'ifpr2026') {
                roleFinal = 'admin';
            } else {
                return res.status(403).json({ error: "Código de autorização de Administrador inválido." });
            }
        }

        // Criptografia da senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        const novoUsuario = new User({
            nome: nome.trim(),
            email: email.toLowerCase().trim(),
            senha: senhaHash,
            role: roleFinal
        });

        await novoUsuario.save();

        return res.status(201).json({
            success: true,
            message: "Conta criada com sucesso!",
            user: {
                id: novoUsuario._id,
                nome: novoUsuario.nome,
                email: novoUsuario.email,
                role: novoUsuario.role
            }
        });

    } catch (error) {
        console.error("Erro no cadastro:", error.message);
        return res.status(500).json({ error: "Erro interno ao cadastrar usuário no banco de dados." });
    }
});

// Login de Usuário / Admin
router.post('/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: "Informe e-mail e senha para entrar." });
        }

        // Busca o usuário no MongoDB
        const usuario = await User.findOne({ email: email.toLowerCase().trim() });
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado. Verifique o e-mail digitado." });
        }

        // Valida a senha criptografada
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(401).json({ error: "Senha incorreta. Tente novamente." });
        }

        return res.json({
            success: true,
            message: "Login realizado com sucesso!",
            user: {
                id: usuario._id,
                nome: usuario.nome,
                email: usuario.email,
                role: usuario.role
            }
        });

    } catch (error) {
        console.error("Erro no login:", error.message);
        return res.status(500).json({ error: "Erro interno no servidor ao autenticar." });
    }
});


// =================================================================
// 2. ROTAS DO CHAT E HISTÓRICO MONGODB
// =================================================================
router.post('/chat', chatController.enviarMensagem);
router.get('/chats', chatController.listarConversas);
router.get('/chats/:id', chatController.obterConversaPorId);
router.delete('/chats/:id', chatController.excluirConversa);


// =================================================================
// 3. ROTAS DO FÓRUM (RAG BASE)
// =================================================================
router.get('/posts', async (req, res) => {
    try {
        const { filtro } = req.query;
        let query = {};
        if (filtro === 'resolvido') query.statusResolvido = true;

        const posts = await Post.find(query).sort({ createdAt: -1 });
        return res.json(posts);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar postagens." });
    }
});

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
        return res.status(500).json({ error: "Falha ao salvar postagem." });
    }
});

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

router.delete('/posts/:id', async (req, res) => {
    try {
        const postExcluido = await Post.findByIdAndDelete(req.params.id);
        if (!postExcluido) {
            return res.status(404).json({ error: "Postagem não encontrada no banco." });
        }
        return res.json({ success: true, message: "Postagem excluída com sucesso." });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao excluir postagem." });
    }
});

module.exports = router;