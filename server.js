// 1. Configuração de DNS para resolver a conexão com o MongoDB Atlas
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// 2. Importação direta e exata da sua pasta routes/chatRoutes.js
const apiRoutes = require('./routes/chatRoutes');

const app = express();

// 3. Middlewares Globais
app.use(cors());

// Limite de 50MB para suportar imagens em Base64 e mensagens longas
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Rota Raiz (Health Check para Render e navegadores)
app.get('/', (req, res) => {
    res.json({
        projeto: "Overflowia.AI",
        status: "online",
        banco: mongoose.connection.readyState === 1 ? "conectado" : "desconectado"
    });
});

// 5. Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
    .catch(err => console.error("❌ Erro no MongoDB:", err.message));

// 6. Registra todas as rotas com o prefixo /api
app.use('/api', apiRoutes);

// 7. Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Overflowia rodando na porta ${PORT}`);
});