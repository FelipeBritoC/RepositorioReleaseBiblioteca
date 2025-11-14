import mysql from "mysql2/promise";

export const db = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "dblivraria",
  port: 3306,
});

