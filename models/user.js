const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, "O nome é obrigatório"],
        trim: true
    },
    email: {
        type: String,
        required: [true, "O e-mail é obrigatório"],
        unique: true,
        lowercase: true,
        trim: true
    },
    senha: {
        type: String,
        required: [true, "A senha é obrigatória"]
    },
    role: {
        type: String,
        enum: ['aluno', 'admin'],
        default: 'aluno'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);