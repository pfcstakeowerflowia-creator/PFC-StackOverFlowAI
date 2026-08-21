const mongoose = require('mongoose');

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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índice de busca textual para otimizar as consultas RAG da Inteligência Artificial
PostSchema.index({ titulo: 'text', desc: 'text', tags: 'text' });

module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);