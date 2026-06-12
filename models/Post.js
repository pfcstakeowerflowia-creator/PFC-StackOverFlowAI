const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    titulo: String,
    desc: String,
    tags: [String],
    votos: { type: Number, default: 0 },
    author: { type: String, default: "Aluno PFC" },
    statusResolvido: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);