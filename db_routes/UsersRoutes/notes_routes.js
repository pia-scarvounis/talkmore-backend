import { application, json, Router } from "express";
import dBpool from "../../config/db.js";
import dotenv from "dotenv";
import pool from "../../config/db.js";
//middleware
import { authenticateToken, requireTeamLeaderOrAdmin } from "../../AuthenticateUsers/AuthMiddleware.js";

dotenv.config();

const router = Router();

//Denne sjekker hvilken database navn vi bruker
const [dbResult] = await pool.query("SELECT DATABASE() AS db");
console.log("Koden kjører mot databasen:", dbResult[0].db);

//NOTES rutere for opprette, endre og slette notater (admin og leserollen)

//NOTE POST - opprette notat
router.post("/", authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
  const { employee_id, note } = req.body;
  if (!employee_id || !note) {
    return res.status(400).json({ error: "mangler data" });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO note (employee_id, note, last_modified)
            VALUE(?, ?, NOW())`,
      [employee_id, note]
    );
    //legger inn notat i arrayet. Nytt notat
    const newNote = {
      note_id: result.insertId,
      employee_id: employee_id,
      note,
      last_modiefied: new Date(),
    };
    res.status(201).json({ newNote });
  } catch (err) {
    console.error("Feil ved opprettelse av notat", err);
    res.status(500).json({ error: "Noe gikk galt" });
  }
});

//NOTE PUT - endre notat
router.put("/:noteId", authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
  //henter id fra url
  const noteId = req.params.noteId;
  //notat som endres i body (input)
  const { note } = req.body;

  if (!note) return res.status(400).json({ error: "notat mangler" });

  try {
    await pool.query(
      `UPDATE note SET note = ?, last_modified = NOW() WHERE note_id = ?`,
      [note, noteId]
    );
    res.status(200).json({ noteId, note });
  } catch (err) {
    console.error("Feil ved oppdatering av notat", err);
    res.status(500).json({ error: "Noe gikk galt" });
  }
});

//NOTE GET - hente notat for en ansatt
router.get("/:employeeId", authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
  const employee_id = req.params.employeeId;

  try {
    const [note] = await pool.query(
      `SELECT * FROM note WHERE employee_id = ? ORDER BY last_modified DESC`,
      [employee_id]
    );
    res.json(note);
  } catch (err) {
    console.error("Feil ved henting av notater:", err);
    res.status(500).json({ error: "Noe gikk galt" });
  }
});

//NOTE DELETE - slette et notat
router.delete("/:noteId", authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
  const { noteId } = req.params;

  try {
    const [result] = await pool.query(`DELETE FROM note WHERE note_id = ?`, [
      noteId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Notat ikke funnet" });
    }
    res.status(200).json({ ok: "Notat slettet" });
  } catch (err) {
    console.error("Feil ved sletting av notat", err);
    res.status(500).json({ error: "Noe gikk galt" });
  }
});

export default router;
