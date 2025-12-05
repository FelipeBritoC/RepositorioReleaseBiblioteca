import {
    marcarFavorito,
    listarFavoritos,
    excluirFavoritos
 } from "../controllers/favoritos.controllers.js";

 import express from "express";

 const router = express();
 router.post("/", marcarFavorito);
 router.get("/", listarFavoritos);
 router.post("/:id",excluirFavoritos);

 export default router;