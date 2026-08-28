const mongoose = require('mongoose');

// Schema de cada mensagem individual trocada no chat
const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['user', 'ai'],
        required: true
    },
    text: {
        type: String,
        required: true
    },
    attachment: {
        name: String,
        mimeType: String,
        base64: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Schema da conversa completa salva no MongoDB Atlas
const ChatSchema = new mongoose.Schema({
    title: {
        type: String,
        default: "Nova Conversa"
    },
    author: {
        type: String,
        default: "Aluno PFC Logado"
    },
    messages: [MessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Exporta o modelo com proteção contra recompilação múltipla
module.exports = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);
