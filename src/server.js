// ============================
//  Dependências
// ============================

import bodyParser from "body-parser";
import cors from "cors";
import livroRoutes from "./routes/livrosroutes.js";
import usuarioRoutes from "./routes/usuariosroutes.js";
import routesAvaliações from "./routes/avaliacoesroutes.js";
import express from "express"
// ============================
//  Configuração do servidor
// ============================
const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/livros", livroRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/routesAvaliações", routesAvaliações);

// ============================
//  Conexão com o MariaDB
// ============================

console.log("✅ Conectado ao banco de dados dblivraria!");

// ============================
//  Rotas CRUD
// ============================

// ============================
//  Inicia o servidor
// ============================
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
