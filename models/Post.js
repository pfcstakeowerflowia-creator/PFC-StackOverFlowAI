const mongoose = require('mongoose');

// Schema individual para cada resposta (Humana ou da IA)
const RespostaSchema = new mongoose.Schema({
    tipo: {
        type: String,
        enum: ['humano', 'ia'],
        default: 'humano'
    },
    autor: {
        type: String,
        required: true,
        default: "Aluno PFC"
    },
    role: {
        type: String,
        enum: ['aluno', 'admin', 'ia'],
        default: 'aluno'
    },
    texto: {
        type: String,
        required: [true, "O conteúdo da resposta é obrigatório"],
        trim: true
    },
    votos: {
        type: Number,
        default: 0
    },
    isMelhorResposta: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Schema principal da Dúvida no Fórum
const PostSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: [true, "O título da postagem é obrigatório"],
        trim: true
    },
    desc: {
        type: String,
        required: [true, "A descrição da postagem é obrigatória"],
        trim: true
    },
    tags: {
        type: [String],
        default: ["RAG", "Base de Conhecimento"]
    },
    votos: {
        type: Number,
        default: 0
    },
    author: {
        type: String,
        default: "Aluno PFC"
    },
    statusResolvido: {
        type: Boolean,
        default: false
    },
    // Array que armazena todas as respostas da comunidade e da IA
    respostas: [RespostaSchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índice de busca textual para otimizar as consultas RAG
PostSchema.index({ titulo: 'text', desc: 'text', tags: 'text' });

module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);