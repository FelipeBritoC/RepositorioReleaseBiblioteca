import {db} from "../config/db.js"

export async function fazeravaliacao (req, res) {
  try {
    const { usuario_id, livro_id, nota, comentario} = req.body;
    if ( !usuario_id || !livro_id || !nota || !comentario)
      return res.status(400).json({ erro: "Campos obrigatórios" });

    await db.execute(
      "INSERT INTO usuario_id, livro_id, nota, comentario (?, ?, ?, ?)",
      [usuario_id, livro_id, nota, comentario]
    );

    res.json({ mensagem: "avaliacao feita com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

export async function listaravaliacoes(req,res){
  try {
    const [rows] = await db.execute("SELECT * FROM avaliacoes");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};


