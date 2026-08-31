const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (e) {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const apiRoutes = require('./routes/chatRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir frontend estático
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Conexão direta com o MongoDB Atlas
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
    mongoose.connect(mongoURI)
        .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
        .catch(err => console.error("❌ Erro no MongoDB:", err.message));
} else {
    console.warn("⚠️ AVISO: MONGODB_URI não encontrada no arquivo .env!");
}

// Rotas da API
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Overflowia rodando em: http://localhost:${PORT}`);
});