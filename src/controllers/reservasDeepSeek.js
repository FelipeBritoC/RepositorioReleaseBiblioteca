import { db } from "../config/db.js";

export async function criarReserva(req, res) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { 
      usuario_id, 
      livro_id, 
      data_retirada, 
      data_devolucao, 
      confirmado_email = false // Valor padrão conforme DEFAULT FALSE
    } = req.body;

    // Validação completa dos campos obrigatórios
    const camposObrigatorios = {
      usuario_id: 'ID do usuário',
      livro_id: 'ID do livro', 
      data_retirada: 'Data de retirada',
      data_devolucao: 'Data de devolução'
    };

    const camposFaltantes = Object.entries(camposObrigatorios)
      .filter(
        ([campo]) => req.body[campo] === undefined || req.body[campo] === null || req.body[campo] === ''
    )
      .map(([_, nome]) => nome);

    if (camposFaltantes.length > 0) {
      return res.status(400).json({ 
        erro: "Campos obrigatórios faltando", 
        campos: camposFaltantes 
      });
    }

    // Validação de tipos
    if (isNaN(usuario_id) || isNaN(livro_id)) {
      return res.status(400).json({ 
        erro: "IDs devem ser números válidos" 
      });
    }

    // Validação do campo confirmado_email
    if (confirmado_email !== undefined && typeof confirmado_email !== 'boolean') {
      return res.status(400).json({ 
        erro: "confirmado_email deve ser true ou false" 
      });
    }

    // Validação de datas
    const dataRetirada = new Date(data_retirada);
    const dataDevolucao = new Date(data_devolucao);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Verificar se as datas são válidas
    if (isNaN(dataRetirada.getTime()) || isNaN(dataDevolucao.getTime())) {
      return res.status(400).json({ 
        erro: "Datas fornecidas são inválidas" 
      });
    }

    if (dataRetirada < hoje) {
      return res.status(400).json({ 
        erro: "Data de retirada não pode ser no passado" 
      });
    }

    if (dataDevolucao <= dataRetirada) {
      return res.status(400).json({ 
        erro: "Data de devolução deve ser após a data de retirada" 
      });
    }

    // Limite máximo de dias para reserva (30 dias)
    const diferencaDias = (dataDevolucao - dataRetirada) / (1000 * 60 * 60 * 24);
    const LIMITE_MAXIMO_DIAS = 30;
    
    if (diferencaDias > LIMITE_MAXIMO_DIAS) {
      return res.status(400).json({ 
        erro: `Período de reserva não pode exceder ${LIMITE_MAXIMO_DIAS} dias` 
      });
    }

    // VALIDAÇÕES DE NEGÓCIO

    // 1. Verificar se usuário existe e está ativo
    const [usuarioExiste] = await connection.execute(
      "SELECT id, ativo FROM usuarios WHERE id = ?",
      [usuario_id]
    );
    
    if (usuarioExiste.length === 0) {
      return res.status(404).json({ 
        erro: "Usuário não encontrado" 
      });
    }

    // Se você tiver campo 'ativo' na tabela usuarios, descomente:
    // if (!usuarioExiste[0].ativo) {
    //   return res.status(400).json({ 
    //     erro: "Usuário inativo. Não é possível fazer reservas." 
    //   });
    // }

    // 2. Verificar se livro existe
    const [livroExiste] = await connection.execute(
      "SELECT id, disponivel FROM livros WHERE id = ?",
      [livro_id]
    );
    
    if (livroExiste.length === 0) {
      return res.status(404).json({ 
        erro: "Livro não encontrado" 
      });
    }

    // 3. Verificar se livro está disponível (se tiver campo 'disponivel')
    if (livroExiste[0].disponivel !== undefined && !livroExiste[0].disponivel) {
      return res.status(409).json({ 
        erro: "Livro indisponível para reserva" 
      });
    }

    // 4. Verificar conflito de reservas para o mesmo livro
    const [reservaConflito] = await connection.execute(
      `SELECT id FROM reservas 
       WHERE livro_id = ? 
       AND (
         (data_retirada BETWEEN ? AND ?) 
         OR (data_devolucao BETWEEN ? AND ?)
         OR (? BETWEEN data_retirada AND data_devolucao)
         OR (? BETWEEN data_retirada AND data_devolucao)
       )`,
      [
        livro_id,
        data_retirada, data_devolucao,
        data_retirada, data_devolucao,
        data_retirada, data_devolucao
      ]
    );
    
    if (reservaConflito.length > 0) {
      return res.status(409).json({ 
        erro: "Livro já reservado para este período" 
      });
    }

    // 5. Verificar limite de reservas ativas por usuário
    const [reservasAtivasUsuario] = await connection.execute(
      `SELECT COUNT(*) as total FROM reservas 
       WHERE usuario_id = ? 
       AND data_devolucao >= CURDATE()`,
      [usuario_id]
    );
    
    const LIMITE_RESERVAS = 5; // Ajuste conforme necessário
    if (reservasAtivasUsuario[0].total >= LIMITE_RESERVAS) {
      return res.status(400).json({ 
        erro: `Limite de ${LIMITE_RESERVAS} reservas ativas atingido` 
      });
    }

    // INSERÇÃO DA RESERVA
    const [result] = await connection.execute(
      `INSERT INTO reservas 
       (usuario_id, livro_id, data_retirada, data_devolucao, confirmado_email) 
       VALUES (?, ?, ?, ?, ?)`,
      [usuario_id, livro_id, data_retirada, data_devolucao, confirmado_email]
    );

    // Atualizar status do livro para indisponível (se tiver campo 'disponivel')
    if (livroExiste[0].disponivel !== undefined) {
      await connection.execute(
        "UPDATE livros SET disponivel = false WHERE id = ?",
        [livro_id]
      );
    }

    await connection.commit();

    // Buscar reserva criada com dados completos
    const [reservaCriada] = await connection.execute(
      `SELECT r.*, u.nome as usuario_nome, l.titulo as livro_titulo
       FROM reservas r
       LEFT JOIN usuarios u ON r.usuario_id = u.id
       LEFT JOIN livros l ON r.livro_id = l.id
       WHERE r.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ 
      mensagem: "Reserva criada com sucesso!",
      reserva: reservaCriada[0]
    });

  } catch (err) {
    await connection.rollback();
    
    console.error("Erro ao criar reserva:", err);
    
    // Tratamento específico de erros do MySQL
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        erro: "Reserva duplicada" 
      });
    }
    
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ 
        erro: "Usuário ou livro não encontrado" 
      });
    }

    if (err.code === 'ER_TRUNCATED_WRONG_VALUE') {
      return res.status(400).json({ 
        erro: "Formato de data inválido. Use YYYY-MM-DD" 
      });
    }

    res.status(500).json({ 
      erro: "Erro interno do servidor ao criar reserva",
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
}

export async function listarReservas(req, res) {
  try {
    const { 
      usuario_id, 
      livro_id, 
      ativas, 
      confirmadas,
      pagina = 1, 
      limite = 10 
    } = req.query;
    
    let query = `
      SELECT 
        r.*, 
        u.nome as usuario_nome, 
        u.email as usuario_email,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        l.isbn as livro_isbn
      FROM reservas r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN livros l ON r.livro_id = l.id
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM reservas r
    `;
    
    let whereConditions = [];
    let params = [];
    
    // Filtros
    if (usuario_id) {
      whereConditions.push("r.usuario_id = ?");
      params.push(usuario_id);
    }
    
    if (livro_id) {
      whereConditions.push("r.livro_id = ?");
      params.push(livro_id);
    }
    
    if (ativas === 'true') {
      whereConditions.push("r.data_devolucao >= CURDATE()");
    } else if (ativas === 'false') {
      whereConditions.push("r.data_devolucao < CURDATE()");
    }
    
    if (confirmadas === 'true') {
      whereConditions.push("r.confirmado_email = true");
    } else if (confirmadas === 'false') {
      whereConditions.push("r.confirmado_email = false");
    }
    
    // Aplicar WHERE conditions
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }
    
    // Ordenação e paginação
    query += " ORDER BY r.criado_em DESC LIMIT ? OFFSET ?";
    const offset = (pagina - 1) * limite;
    params.push(Number(limite), offset);
    
    const [rows] = await db.execute(query, params);
    const [countResult] = await db.execute(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    
    res.json({
      reservas: rows,
      paginacao: {
        pagina: Number(pagina),
        limite: Number(limite),
        total,
        paginas: Math.ceil(total / limite)
      }
    });
    
  } catch (err) {
    console.error("Erro ao listar reservas:", err);
    res.status(500).json({ 
      erro: "Erro ao buscar reservas",
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

export async function excluirReserva(req, res) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        erro: "ID da reserva é obrigatório e deve ser um número" 
      });
    }

    // Buscar reserva para validar e obter livro_id
    const [reserva] = await connection.execute(
      `SELECT r.*, l.disponivel 
       FROM reservas r
       LEFT JOIN livros l ON r.livro_id = l.id
       WHERE r.id = ?`,
      [id]
    );
    
    if (reserva.length === 0) {
      return res.status(404).json({ 
        erro: "Reserva não encontrada" 
      });
    }
    
    const reservaData = reserva[0];
    
    // Verificar se a reserva já começou
    const hoje = new Date().toISOString().split('T')[0];
    if (reservaData.data_retirada <= hoje) {
      return res.status(400).json({ 
        erro: "Não é possível cancelar uma reserva que já iniciou" 
      });
    }

    // Excluir a reserva
    await connection.execute(
      "DELETE FROM reservas WHERE id = ?",
      [id]
    );

    // Liberar livro para novas reservas (se tiver campo disponivel)
    if (reservaData.disponivel !== undefined) {
      await connection.execute(
        "UPDATE livros SET disponivel = true WHERE id = ?",
        [reservaData.livro_id]
      );
    }

    await connection.commit();
    
    res.json({ 
      mensagem: "Reserva cancelada com sucesso!",
      id: Number(id)
    });
    
  } catch (err) {
    await connection.rollback();
    
    console.error("Erro ao cancelar reserva:", err);
    
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ 
        erro: "Não é possível excluir a reserva devido a registros relacionados" 
      });
    }

    res.status(500).json({ 
      erro: "Erro ao cancelar reserva",
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
}

export async function buscarReservaPorId(req, res) {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        erro: "ID da reserva é obrigatório e deve ser um número" 
      });
    }

    const [rows] = await db.execute(
      `SELECT 
        r.*, 
        u.nome as usuario_nome, 
        u.email as usuario_email,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        l.isbn as livro_isbn,
        l.editora as livro_editora,
        l.ano_publicacao as livro_ano_publicacao
       FROM reservas r
       LEFT JOIN usuarios u ON r.usuario_id = u.id
       LEFT JOIN livros l ON r.livro_id = l.id
       WHERE r.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        erro: "Reserva não encontrada" 
      });
    }
    
    res.json(rows[0]);
    
  } catch (err) {
    console.error("Erro ao buscar reserva:", err);
    res.status(500).json({ 
      erro: "Erro ao buscar reserva" 
    });
  }
}

// Nova função para atualizar confirmação de email
export async function confirmarEmailReserva(req, res) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        erro: "ID da reserva é obrigatório" 
      });
    }

    // Verificar se reserva existe
    const [reserva] = await connection.execute(
      "SELECT id, confirmado_email FROM reservas WHERE id = ?",
      [id]
    );
    
    if (reserva.length === 0) {
      return res.status(404).json({ 
        erro: "Reserva não encontrada" 
      });
    }

    if (reserva[0].confirmado_email) {
      return res.status(400).json({ 
        erro: "Email já foi confirmado anteriormente" 
      });
    }

    // Atualizar confirmação
    await connection.execute(
      "UPDATE reservas SET confirmado_email = true WHERE id = ?",
      [id]
    );

    await connection.commit();
    
    res.json({ 
      mensagem: "Email confirmado com sucesso!",
      id: Number(id)
    });
    
  } catch (err) {
    await connection.rollback();
    
    console.error("Erro ao confirmar email:", err);
    res.status(500).json({ 
      erro: "Erro ao confirmar email" 
    });
  } finally {
    connection.release();
  }
}

// Função para estatísticas (opcional)
export async function obterEstatisticasReservas(req, res) {
  try {
    const [estatisticas] = await db.execute(`
      SELECT 
        COUNT(*) as total_reservas,
        COUNT(CASE WHEN data_retirada > CURDATE() THEN 1 END) as reservas_futuras,
        COUNT(CASE WHEN data_retirada <= CURDATE() AND data_devolucao >= CURDATE() THEN 1 END) as reservas_ativas,
        COUNT(CASE WHEN confirmado_email = true THEN 1 END) as emails_confirmados,
        COUNT(CASE WHEN confirmado_email = false THEN 1 END) as emails_pendentes
      FROM reservas
    `);
    
    res.json(estatisticas[0]);
    
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ 
      erro: "Erro ao buscar estatísticas" 
    });
  }
}