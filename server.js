const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors()); // Permite que seu frontend acesse o backend
app.use(bodyParser.json());

// Banco de dados em memória (Simulação)
// Quando o servidor reiniciar, esses dados voltam ao estado inicial
let posts = [
    {
        id: '1', 
        titulo: "Erro Cors no Express Deploy Server", 
        desc: "Estou tendo dor de cabeça enorme tentando apontar a UI React minha com minha API Express...", 
        tags: ["express", "nodejs", "cors"], 
        votos: 14, 
        author: "TechStudent_", 
        statusResolvido: true 
    },
    {
        id: '2', 
        titulo: "Centering Div usando css display table", 
        desc: "Poderia nossa Inteligência e Alunos confirmarem isso de boas práticas?",
        tags: ["css3", "design"], 
        votos: 2, 
        author: "JulianoUI_Front", 
        statusResolvido: false 
    }
];

// --- ENDPOINTS DO FÓRUM ---

// Listar todos os posts
app.get('/api/posts', (req, res) => {
    res.json(posts);
});

// Criar novo post
app.post('/api/posts', (req, res) => {
    const { titulo, desc, tags, author } = req.body;
    
    const newPost = {
        id: Date.now().toString(),
        titulo,
        desc,
        tags: tags || [],
        votos: 0,
        author: author || "Anônimo",
        statusResolvido: false
    };

    posts.unshift(newPost); // Adiciona no início da lista
    res.status(201).json(newPost);
});

// Dar Upvote em um post
app.patch('/api/posts/:id/vote', (req, res) => {
    const { id } = req.params;
    const post = posts.find(p => p.id === id);
    
    if (post) {
        post.votos += 1;
        return res.json({ votos: post.votos });
    }
    res.status(404).json({ message: "Post não encontrado" });
});

// --- ENDPOINT DA IA (SIMULAÇÃO RAG) ---

app.post('/api/ia/chat', (req, res) => {
    const { prompt } = req.body;

    // Aqui no futuro você conectará com a API da OpenAI ou LangChain
    const respostaSimulada = {
        role: "assistant",
        content: `Recebi sua dúvida sobre: "${prompt}". Analisando nossa base de dados (RAG), recomendo verificar a documentação oficial e os posts recentes no fórum.`,
        timestamp: new Date()
    };

    setTimeout(() => {
        res.json(respostaSimulada);
    }, 1500); // Simula um delay de pensamento da IA
});

// Inicialização
app.listen(PORT, () => {
    console.log(`🚀 Servidor Overflowia.AI rodando em http://localhost:${PORT}`);
});