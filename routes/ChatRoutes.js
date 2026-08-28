const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chatController = require('/controllers/ChatController');
const Post = require('../models/Post');
const User = require('../models/User');

// =================================================================
// 1. ROTAS DE AUTENTICAÇÃO NO MONGODB ATLAS
// =================================================================
router.post('/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, role, adminCode } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
        }

        const usuarioExistente = await User.findOne({ email: email.toLowerCase().trim() });
        if (usuarioExistente) {
            return res.status(400).json({ error: "Este e-mail já está cadastrado no sistema." });
        }

        let roleFinal = 'aluno';
        if (role === 'admin') {
            if (adminCode === 'admin2026' || adminCode === 'ifpr2026') {
                roleFinal = 'admin';
            } else {
                return res.status(403).json({ error: "Código de autorização de Administrador inválido." });
            }
        }

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
        return res.status(500).json({ error: "Erro ao cadastrar usuário no banco de dados." });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: "Informe e-mail e senha para entrar." });
        }

        const usuario = await User.findOne({ email: email.toLowerCase().trim() });
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado. Verifique o e-mail." });
        }

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
        return res.status(500).json({ error: "Erro interno ao autenticar." });
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
// 3. ROTAS DO FÓRUM (RAG BASE, RESPOSTAS & COMENTÁRIOS)
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

router.get('/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Pergunta não encontrada." });
        return res.json(post);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao carregar detalhes da dúvida." });
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
            statusResolvido: false,
            respostas: []
        });

        await novoPost.save();
        return res.status(201).json(novoPost);
    } catch (error) {
        return res.status(500).json({ error: "Falha ao salvar postagem no banco." });
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

// Adicionar Resposta Humana à Pergunta
router.post('/posts/:id/respostas', async (req, res) => {
    try {
        const { texto, autor, role } = req.body;

        if (!texto || !texto.trim()) {
            return res.status(400).json({ error: "O conteúdo da resposta não pode ficar em branco." });
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: "Pergunta não encontrada para responder." });
        }

        const novaResposta = {
            tipo: 'humano',
            autor: autor || "Aluno PFC Logado",
            role: role || "aluno",
            texto: texto.trim(),
            votos: 0,
            isMelhorResposta: false,
            comentarios: [],
            createdAt: new Date()
        };

        post.respostas.push(novaResposta);
        await post.save();

        return res.status(201).json({
            success: true,
            resposta: post.respostas[post.respostas.length - 1],
            post: post
        });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao salvar a resposta no banco." });
    }
});

// Adicionar Comentário/Réplica em uma Resposta Específica
router.post('/posts/:postId/respostas/:respostaId/comentarios', async (req, res) => {
    try {
        const { texto, autor, role } = req.body;

        if (!texto || !texto.trim()) {
            return res.status(400).json({ error: "O comentário não pode ficar vazio." });
        }

        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: "Pergunta não encontrada." });
        }

        const resposta = post.respostas.id(req.params.respostaId) || post.respostas.find(r => r._id.toString() === req.params.respostaId);
        if (!resposta) {
            return res.status(404).json({ error: "Resposta não encontrada para comentar." });
        }

        if (!resposta.comentarios) {
            resposta.comentarios = [];
        }

        resposta.comentarios.push({
            autor: autor || "Aluno PFC Logado",
            role: role || "aluno",
            texto: texto.trim(),
            createdAt: new Date()
        });

        await post.save();

        return res.status(201).json({
            success: true,
            comentarios: resposta.comentarios,
            post: post
        });
    } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
        return res.status(500).json({ error: "Erro ao salvar comentário no banco de dados." });
    }
});

// Gerar Resposta Automática da IA com Gemini
router.post('/posts/:id/gerar-resposta-ia', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: "Pergunta não encontrada." });
        }

        const respostaIAExistente = post.respostas.find(r => r.tipo === 'ia');
        if (respostaIAExistente) {
            return res.json({
                success: true,
                resposta: respostaIAExistente,
                jaExistia: true
            });
        }

        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) {
            return res.status(500).json({ error: "Chave GEMINI_API_KEY não configurada no servidor." });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelos = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"];

        const prompt = `Você é o assistente inteligente Overflowia.AI.
Um estudante publicou a seguinte dúvida técnica no fórum:

[TÍTULO]: ${post.titulo}
[DESCRIÇÃO / CÓDIGO DO PROBLEMA]: ${post.desc}
[TAGS]: ${post.tags.join(', ')}

DIRETRIZES:
1. Apresente uma solução direta, tecnicamente correta e didática.
2. Explique brevemente o porquê do erro ter acontecido.
3. Se fornecer código, use blocos Markdown indicando a linguagem (ex: \`\`\`javascript, \`\`\`python, \`\`\`css, \`\`\`html).
4. Seja conciso e profissional.`;

        let textoIA = null;
        let erroIA = null;

        for (const nomeModelo of modelos) {
            try {
                const model = genAI.getGenerativeModel({
                    model: nomeModelo,
                    generationConfig: { temperature: 0.7 }
                });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                textoIA = response.text();
                if (textoIA) break;
            } catch (err) {
                erroIA = err;
                console.warn(`Tentativa da IA com ${nomeModelo} falhou:`, err.message);
            }
        }

        if (!textoIA) {
            throw erroIA || new Error("Falha ao gerar resposta com a IA.");
        }

        const novaRespostaIA = {
            tipo: 'ia',
            autor: 'Overflowia.AI (Assistente Oficial)',
            role: 'ia',
            texto: textoIA,
            votos: 1,
            isMelhorResposta: false,
            comentarios: [],
            createdAt: new Date()
        };

        post.respostas.unshift(novaRespostaIA);
        await post.save();

        return res.status(201).json({
            success: true,
            resposta: novaRespostaIA,
            post: post
        });

    } catch (error) {
        return res.status(500).json({ error: error.message || "Erro ao gerar resposta com IA." });
    }
});

// Marcar / Desmarcar Melhor Resposta
router.patch('/posts/:id/respostas/:respId/solucao', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Pergunta não encontrada." });

        let respostaEncontrada = false;

        post.respostas.forEach(r => {
            if (r._id.toString() === req.params.respId) {
                r.isMelhorResposta = !r.isMelhorResposta;
                respostaEncontrada = true;
            } else {
                r.isMelhorResposta = false;
            }
        });

        if (!respostaEncontrada) {
            return res.status(404).json({ error: "Resposta não encontrada." });
        }

        post.statusResolvido = post.respostas.some(r => r.isMelhorResposta);
        await post.save();

        return res.json({
            success: true,
            statusResolvido: post.statusResolvido,
            respostas: post.respostas
        });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao definir melhor resposta." });
    }
});

module.exports = router;