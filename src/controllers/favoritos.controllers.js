import {db} from "../config/db.js";

export async function marcarFavorito (req, res) {
  try {
    const { usuario_id, livro_id, data_favoritado} = req.body;
    if (!usuario_id || !livro_id || !data_favoritado)
        return res.status(400).json({ erro: "Campos obrigatórios" });

    await db.execute(
      "INSERT INTO favoritos usuario_id, livro_id, data_favoritado (?, ?, ?)",
      [usuario_id, livro_id, data_favoritado]
    );

    res.json({ mensagem: "favorito marcado com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

export async function listarFavoritos (req,res){
  try {
    const [rows] = await db.execute("SELECT * FROM favoritos");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

export async function excluirFavoritos(req,res) {
    try {
        await db.execute("DELETE FROM reservas WHERE id = ?", [req.params.id]);
        res.json({ mensagem: "Reserva cancelada com sucesso!" })
    } catch (err) {
        res.status(500).json({erro: err.message})
    }
}

