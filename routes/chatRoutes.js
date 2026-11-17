const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Importações dos modelos e do controller
const chatController = require('../controllers/chatController');
const Post = require('../models/Post');
const User = require('../models/User');

// Carregador dinâmico do SDK @google/genai (compatível com ESM + top-level await)
let _GoogleGenAI = null;
async function criarClienteGenAI(apiKey) {
    if (!_GoogleGenAI) {
        const modulo = await import('@google/genai');
        _GoogleGenAI = modulo.GoogleGenAI;
    }
    return new _GoogleGenAI({ apiKey });
}

// Função auxiliar para gerar embedding vetorial de forma segura
async function gerarVetorTexto(texto) {
    try {
        const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';
        const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

        if (!apiKey) return [];

        const ai = await criarClienteGenAI(apiKey);
        const resultado = await ai.models.embedContent({
            model: "gemini-embedding-2",
            contents: `Documento de fórum de programação: ${texto}`,
            config: {
                outputDimensionality: 768
            }
        });
        return resultado.embeddings?.[0]?.values || [];
    } catch (err) {
        console.warn("⚠️ Aviso: Falha ao gerar embedding para a postagem:", err.message);
        return [];
    }
}

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
            const codigoValido = process.env.ADMIN_CODE || 'admin2026';
            if (adminCode === codigoValido || adminCode === 'ifpr2026') {
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
// 2. ROTAS DO CHAT COM IA E HISTÓRICO NO MONGODB ATLAS
// =================================================================

router.post('/chat', chatController.enviarMensagem);
router.get('/chats', chatController.listarConversas);
router.get('/chats/:id', chatController.obterConversaPorId);
router.delete('/chats/:id', chatController.excluirConversa);

// =================================================================
// 3. ROTAS DO FÓRUM (PERGUNTAS, VOTAÇÃO E MODERAÇÃO)
// =================================================================

router.get('/posts', async (req, res) => {
    try {
        const { filtro } = req.query;
        let query = {};
        if (filtro === 'resolvido') query.statusResolvido = true;

        const posts = await Post.find(query).sort({ createdAt: -1 });
        return res.json(posts);
    } catch (error) {
        console.error("Erro ao buscar postagens:", error.message);
        return res.status(500).json({ error: "Erro ao buscar postagens." });
    }
});

router.get('/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: "Pergunta não encontrada." });
        }
        return res.json(post);
    } catch (error) {
        console.error("Erro ao carregar dúvida:", error.message);
        return res.status(500).json({ error: "Erro ao carregar detalhes da dúvida." });
    }
});

router.post('/posts', async (req, res) => {
    try {
        const { titulo, desc, tags, author } = req.body;
        if (!titulo || !desc) {
            return res.status(400).json({ error: "Título e descrição são obrigatórios." });
        }

        const textoParaVetor = `${titulo.trim()} - ${desc.trim()}`;
        const embeddingVetor = await gerarVetorTexto(textoParaVetor);

        const novoPost = new Post({
            titulo: titulo.trim(),
            desc: desc.trim(),
            tags: Array.isArray(tags) ? tags : ["RAG", "Geral"],
            author: author || "Aluno PFC Logado",
            votos: 0,
            statusResolvido: false,
            respostas: [],
            embedding: embeddingVetor
        });

        await novoPost.save();
        console.log(`📌 Post publicado! Vetor RAG: ${embeddingVetor.length > 0 ? '768 dimensões geradas ✓' : 'Salvo sem vetor (fallback léxico)'}`);
        return res.status(201).json(novoPost);
    } catch (error) {
        console.error("Erro ao criar postagem:", error.message);
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
        if (!postAtualizado) {
            return res.status(404).json({ error: "Postagem não encontrada." });
        }
        return res.json(postAtualizado);
    } catch (error) {
        console.error("Erro ao votar:", error.message);
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
        console.error("Erro ao excluir postagem:", error.message);
        return res.status(500).json({ error: "Erro ao excluir postagem." });
    }
});

// =================================================================
// 4. ROTAS DE RESPOSTAS, COMENTÁRIOS E IA NO FÓRUM
// =================================================================

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
        console.error("Erro ao salvar resposta:", error.message);
        return res.status(500).json({ error: "Erro ao salvar a resposta no banco." });
    }
});

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
        console.error("Erro ao adicionar comentário:", error.message);
        return res.status(500).json({ error: "Erro ao salvar comentário no banco de dados." });
    }
});

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

        const ai = await criarClienteGenAI(apiKey);
        const modelos = ["gemini-3.8-flash", "gemini-4-argon", "gemini-4-carbon", "gemini-3.6-flash"];

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
                const result = await ai.models.generateContent({
                    model: nomeModelo,
                    contents: prompt,
                    config: { temperature: 0.7 }
                });
                textoIA = result.text;
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
        console.error("Erro ao gerar resposta com IA:", error.message);
        return res.status(500).json({ error: error.message || "Erro ao gerar resposta com IA." });
    }
});

router.patch('/posts/:id/respostas/:respId/solucao', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: "Pergunta não encontrada." });
        }

        let respostaEncontrada = false;
        let textoMelhorSolucao = '';

        post.respostas.forEach(r => {
            if (r._id.toString() === req.params.respId) {
                r.isMelhorResposta = !r.isMelhorResposta;
                respostaEncontrada = true;
                if (r.isMelhorResposta) {
                    textoMelhorSolucao = r.texto;
                }
            } else {
                r.isMelhorResposta = false;
            }
        });

        if (!respostaEncontrada) {
            return res.status(404).json({ error: "Resposta não encontrada." });
        }

        post.statusResolvido = post.respostas.some(r => r.isMelhorResposta);

        if (post.statusResolvido && textoMelhorSolucao) {
            try {
                const textoCompleto = `${post.titulo} - ${post.desc} - Solução: ${textoMelhorSolucao}`;
                const novoVetor = await gerarVetorTexto(textoCompleto);
                if (novoVetor.length > 0) {
                    post.embedding = novoVetor;
                    console.log(`📌 Post [${post.titulo}] re-vetorizado com a Solução Aprovada.`);
                }
            } catch (vErr) {
                console.warn("⚠️ Não foi possível re-vetorizar com a solução:", vErr.message);
            }
        }

        await post.save();

        return res.json({
            success: true,
            statusResolvido: post.statusResolvido,
            respostas: post.respostas
        });
    } catch (error) {
        console.error("Erro ao definir melhor resposta:", error.message);
        return res.status(500).json({ error: "Erro ao definir melhor resposta." });
    }
});

module.exports = router;