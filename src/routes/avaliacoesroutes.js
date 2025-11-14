import {
    fazeravaliacao,
    listaravaliacoes,
} from "../controllers/avaliacoescontrollers.js";

import express from "express";

const router = express.Router();

router.post("/", fazeravaliacao);
router.get("/", listaravaliacoes);

export default router;
