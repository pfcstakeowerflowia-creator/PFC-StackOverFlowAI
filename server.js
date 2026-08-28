const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ATENÇÃO: se seu arquivo for ChatRoutes.js (com C maiúsculo), mantenha ./routes/ChatRoutes
// se for chatRoutes.js (minúsculo), mantenha ./routes/chatRoutes
let apiRoutes;
try {
    apiRoutes = require('/routes/ChatRoutes');
} catch (e) {
    apiRoutes = require('./routes/chatRoutes');
}

const app = express();

// Habilita CORS
app.use(cors());

// Limite de payload em 50MB para suportar imagens em Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
    .catch(err => console.error("❌ Erro no MongoDB:", err.message));

// Registra todas as rotas com o prefixo /api
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Overflowia rodando na porta ${PORT}`));