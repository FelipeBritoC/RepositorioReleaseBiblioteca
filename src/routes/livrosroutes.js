import {
    Registrarlivro,
    listarlivros,
    obterlivro,
    atualizarlivro,
    deletarlivro,
} from "../controllers/livroscontrollers.js";

import express from "express";

const router = express.Router()
router.post("/", Registrarlivro);
router.get("/", listarlivros);
router.get("/:id", obterlivro);
router.put("/:id", atualizarlivro);
router.delete("/:id", deletarlivro);

export default router;