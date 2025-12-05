import { Registrarlivro } from "../controllers/livroscontrollers.js";
import {
    criarReserva,
    listarReservas,
    excluirReserva
} from "../controllers/reservascontrollers.js";

import express from "express";

const router = express();
router.post("/", criarReserva);
router.get("/", listarReservas);
router.delete("/:id", excluirReserva);

export default router;
