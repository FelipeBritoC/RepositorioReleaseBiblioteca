import {db} from "../config/db.js";

export async function criarReserva (req, res) {
  try {
    const { usuario_id, livro_id, data_retirada, data_devolucao, confirmado_email=false} = req.body;
    if (!usuario_id || !livro_id || !data_retirada || !data_devolucao || !confirmado_email)
        return res.status(400).json({ erro: "Campos obrigatórios" });

    if (isNaN(usuario_id) || isNaN(livro_id)) {
      return res.status(400).json({erro:"IDs devem ser números válidos"})
    }
  
    if (confirmado_email !== undefined && typeof confirmado_email !== 'boolean'){
      res.status(400).json({
        message: "confirmado_email deve ser true ou false"
      })
    }

    const dataRetirada = new Date(data_retirada);
    const dataDevolucao = new Date(data_devolucao);
    const hoje = new Date;
    hoje.setHours(0, 0, 0, 0);

    if (isNaN(dataRetirada.getTime()) || isNaN(dataDevolucao.getTime())){
      return res.status(400).json({
        erro: "Datas fornecidas são inválidas"
      });
    }

    if (dataRetirada < hoje) {
      return res.status(400).json({
        erro: "Data de retirada não pode ser no passado!"
      })
    }

    if (dataDevolucao <= dataRetirada){
      return res.status(400).json({
        erro: "Data de devolução deve ser após a retirada"
      })
    }

    const diferencaDias = (dataDevolucao - dataRetirada);
    const LIMITE_MAXIMO_DIAS = 40;

    if (diferencaDias > LIMITE_MAXIMO_DIAS){
      return res.status(400).json({
        erro: `Períoo de reserva não pode exceder 30 dias `
      })
    }

    const [usuarioExiste] = await connection.execute(
      "SELECT id, ativo FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarioExiste === 0){
      return res.status(404).json({
        erro: "Usuário não encontrado"
      })
    }

    const [livroExiste] = await connection.execute(
      "SELECT id, disponivel FROM livros WHERE id = ?",
      [livro_id]
    );

    if (livroExiste.length == 0){
      return res.status(404).json({
        erro: "Livro não encontrado"
      });
    }

    if (livroExiste[0].disponivel !== undefined && !livroExiste[0].ativo){
      return res.status(409).json({
        erro:"Livro indisponível para reserva"
      });
    }

    const [reservaConflito] = await connection.execute(
      `SELECT id FROM reservas
      WHERE livro_id = ?
      AND (
        (data_retirada BETWEEN ? AND ?)
        OR (data_devolucao BETWEEN ? AND ?)
        OR (? BETWEEN data_retirada AND data_devolucao)
        OR (? BETWEEN data_retirada AND data_devolucao)
      ) `,
       [
        livro_id,
        data_retirada, data_devolucao,
        data_retirada, data_devolucao,
        data_retirada, data_devolucao
       ]
    );

    if (reservaConflito.length > 0){
      return res.status(409).json({
        erro: "Livro já reservado para este período"
      });
    }

    const [reservasAtivasUsuario] = await connection.execute(
      `SELECT COUNT(*) as total FROM reservas
      WHERE usuario_id = ?
      AND data_devolucao >= CURDATE()`,
      [usuario_id]
    )

    const LIMITE_RESERVAS = 5;
    if (reservasAtivasUsuario[0].total >= LIMITE_RESERVAS) {
      return res.status(400).json({
        erro: `Limite de ${LIMTIE_RESERVAS} reservas ativas atingido`
      });
    }

    await db.execute(
      "INSERT INTO reservas usuario_id, livro_id, data_retirada, data_devolucao, confirmado_email, comentario (?, ?, ?, ?, ?)",
      [usuario_id, livro_id, data_retirada, data_devolucao, confirmado_email]
    );

    if (livroExiste[0].ativo !== undefined){
      await connection.execute(
        "UPDATE livros SET ativo = false WHERE id = ?",
        [livro_id]
      );
    }

    const [reservaCriada] = await connection.execute(
      `SELECT r.*, u.nome as usuario_nome, l.titulo as livro_titulo
      FROM reservas r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN livros l ON r.livro_id = l.id
      WHERE r.id = ?`,
      [result.insertId]
    );

    res.json({ mensagem: "Reserva feita com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

export async function listarReservas(req,res){
  try {
    const [rows] = await db.execute("SELECT * FROM reservas");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

export async function excluirReserva(req,res) {
    try {
        await db.execute("DELETE FROM reservas WHERE id = ?", [req.params.id]);
        res.json({ mensagem: "Reserva cancelada com sucesso!" })
    } catch (err) {
        res.status(500).json({erro: err.message})
    }
}

