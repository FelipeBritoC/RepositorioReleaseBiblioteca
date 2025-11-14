import {
    CriarUsuario,
    listarUsuario,
    obterUsuario,
    atualizarUsuario,
    deletarUsuario
} from "../controllers/usuarioscontrollers.js";

import express from "express";
const route = express.Router();
route.post("/", CriarUsuario);
route.get("/", listarUsuario);
route.get("/:id", obterUsuario);
route.get("/:id", atualizarUsuario);
route.get("/:id", deletarUsuario);

export default route;