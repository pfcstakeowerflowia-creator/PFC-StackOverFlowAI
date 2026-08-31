// =================================================================
// OVERFLOWIA.AI — SERVIDOR PRINCIPAL (EXPRESS + MONGODB ATLAS)
// Projeto Final de Curso — IFPR Campus Assis Chateaubriand
// =================================================================

const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (dnsErr) {
    console.warn('⚠️ Falha ao configurar DNS:', dnsErr.message);
}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Importação estática direta (Permite à Vercel rastrear e empacotar a rota)
const apiRoutes = require('./routes/chatRoutes');

const app = express();

// Middlewares Globais
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir arquivos estáticos do Frontend
app.use(express.static(path.join(__dirname), { index: false }));

// Rota Principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Diagnóstico da API
app.get('/api/status', (req, res) => {
    res.status(200).json({
        projeto: "Overflowia.AI",
        status: "online",
        plataforma: "IFPR - Campus Assis Chateaubriand",
        banco: mongoose.connection.readyState === 1 ? "conectado" : "desconectado",
        uptime: `${Math.floor(process.uptime())} segundos`,
        timestamp: new Date().toISOString()
    });
});

// Conexão com o MongoDB Atlas
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
    mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    })
    .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
    .catch(err => console.error("❌ Erro no MongoDB:", err.message));
} else {
    console.warn("⚠️ AVISO: MONGODB_URI não configurada nas variáveis de ambiente!");
}

// Registra as rotas da API
app.use('/api', apiRoutes);

// Inicialização do Servidor HTTP
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Overflowia.AI rodando na porta ${PORT}`);
});

module.exports = app;