const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/chatRoutes');

const app = express();

// Habilita CORS para requisições do frontend
app.use(cors());

// Aumenta o limite de payload para 50MB (permite mensagens longas e envio de imagens em Base64)
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