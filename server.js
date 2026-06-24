const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/chatRoutes'); // Importando o arquivo de rotas

const app = express();
app.use(cors());
app.use(express.json());

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
    .catch(err => console.error("❌ Erro no Mongo:", err));

// --- REGISTRO DAS ROTAS (ESTAVA FALTANDO) ---
// Mapeia todas as rotas de apiRoutes para começarem com o prefixo "/api"
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Overflowia na porta ${PORT}`));