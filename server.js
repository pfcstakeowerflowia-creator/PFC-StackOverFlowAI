// =================================================================
// OVERFLOWIA.AI — SERVIDOR PRINCIPAL (EXPRESS + MONGODB ATLAS)
// Projeto Final de Curso — IFPR Campus Assis Chateaubriand
// =================================================================

// 1. Configuração de DNS (Resolve ECONNREFUSED com SRV no Windows/Linux)
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (dnsErr) {
    console.warn('⚠️ Não foi possível alterar os servidores DNS padrão:', dnsErr.message);
}

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// 2. Carregamento Seguro e Dinâmico de Rotas (Imunidade a Case-Sensitivity no Linux/Render)
function carregarRotasSeguras() {
    const pastaRoutes = path.join(__dirname, 'routes');
    try {
        if (fs.existsSync(pastaRoutes)) {
            const arquivos = fs.readdirSync(pastaRoutes);
            const arquivoEncontrado = arquivos.find(f => f.toLowerCase() === 'chatroutes.js');
            if (arquivoEncontrado) {
                return require(path.join(pastaRoutes, arquivoEncontrado));
            }
        }
    } catch (err) {
        console.warn('⚠️ Falha ao inspecionar diretório routes:', err.message);
    }
    // Fallback relativo padrão
    return require('./routes/chatRoutes');
}

let apiRoutes;
try {
    apiRoutes = carregarRotasSeguras();
} catch (errRoutes) {
    console.error('❌ ERRO CRÍTICO AO CARREGAR ROTAS:', errRoutes.message);
}

const app = express();

// 3. Middlewares Globais de Segurança e Processamento
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Limite aumentado para 50MB (permite imagens em Base64 e códigos extensos)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Tratamento para JSON malformado enviado pelo cliente
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "Payload JSON malformatado." });
    }
    next();
});

// 4. Endpoints de Diagnóstico e Health Check (Render e Monitoramento)
app.get('/', (req, res) => {
    res.status(200).json({
        projeto: "Overflowia.AI",
        status: "online",
        plataforma: "IFPR - Campus Assis Chateaubriand",
        banco: mongoose.connection.readyState === 1 ? "conectado" : "desconectado",
        uptime: `${Math.floor(process.uptime())} segundos`,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "ok",
        databaseReady: mongoose.connection.readyState === 1,
        memoryUsage: process.memoryUsage()
    });
});

// 5. Conexão Resiliente com o MongoDB Atlas
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    console.error("❌ ERRO FATAL: A variável MONGODB_URI não foi definida nas variáveis de ambiente!");
} else {
    mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 10000, // Timeout de 10s para não prender o boot
        socketTimeoutMS: 45000,
    })
    .then(() => {
        console.log("✅ Conectado ao MongoDB Atlas com sucesso!");
    })
    .catch((err) => {
        console.error("❌ Falha na conexão inicial com o MongoDB:", err.message);
    });

    // Monitoramento contínuo da conexão
    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ Alerta: Conexão com o MongoDB perdida. Aguardando reconexão...');
    });

    mongoose.connection.on('reconnected', () => {
        console.log('✅ Reconectado ao MongoDB com sucesso!');
    });

    mongoose.connection.on('error', (err) => {
        console.error('❌ Erro contínuo no MongoDB:', err.message);
    });
}

// 6. Registro das Rotas da Aplicação
if (apiRoutes) {
    app.use('/api', apiRoutes);
} else {
    app.use('/api', (req, res) => {
        res.status(503).json({ error: "Serviço de rotas temporariamente indisponível." });
    });
}

// 7. Tratamento de Rotas Não Encontradas (404)
app.use((req, res) => {
    res.status(404).json({
        error: `Rota não encontrada: ${req.method} ${req.originalUrl}`
    });
});

// 8. Tratamento Centralizado de Erros Internos (500)
app.use((err, req, res, next) => {
    console.error("❌ Erro interno do servidor:", err.stack);
    res.status(500).json({
        error: "Ocorreu um erro interno no servidor.",
        detalhe: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 9. Inicialização do Servidor HTTP
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Overflowia.AI operacional na porta ${PORT}`);
});

// 10. Encerramento Gracioso (Graceful Shutdown para Render e SIGINT)
const finalizarProcesso = (sinal) => {
    console.log(`\n🛑 Recebido sinal ${sinal}. Finalizando conexões de forma segura...`);
    server.close(async () => {
        console.log('🔒 Servidor HTTP encerrado.');
        try {
            await mongoose.connection.close(false);
            console.log('🔒 Conexão com MongoDB encerrada com sucesso.');
        } catch (err) {
            console.error('⚠️ Erro ao fechar banco:', err.message);
        }
        process.exit(0);
    });

    // Força saída após 10 segundos se houver conexões presas
    setTimeout(() => {
        console.error('⚠️ Forçando encerramento imediato por timeout.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => finalizarProcesso('SIGTERM'));
process.on('SIGINT', () => finalizarProcesso('SIGINT'));

// 11. Proteção Global contra Travamentos Inesperados
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [Aviso de Rejeição Não Tratada]:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ [Exceção Não Capturada]:', error);
});