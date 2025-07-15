import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../config/db.js";
import dotenv from "dotenv";
import { JWT_SECRET } from "../../config/config.js";

dotenv.config();
//istedenfor import Router
const router = express.Router();

//LOGIN RUTE

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    //hent bruker fra userOfTool tabellen som er aktiv med 1 og ikke uaktiv med 0
    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, u.roles, u.employee_id, e.employee_name, u.password_hash
       FROM userOfTool u 
       JOIN employee e ON u.employee_id = e.employee_id
       WHERE u.username = ? AND u.active = 1`,
      [username]
    );
    const user = rows[0];

    if (!user || !user.password_hash) {
      return res
        .status(401)
        .json({ message: "Ugyldig brukernavn eller passord" });
    }
    console.log("Prøver å logge inn med:");
    console.log("Brukernavn:", username);
    console.log("Sendt passord:", password);
    console.log("Hash fra DB:", user?.password_hash);

    //sjekk passord mot hashed passord at det er gyldig
    const isMatch = await bcrypt.compare(password, user.password_hash);
    //hvis ikke passord matcher
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Ugyldig brukernavn eller passord" });
    }
    console.log("JWT_SECRET:", JWT_SECRET);

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.roles, //ADMIN / TEAMLEDER
        employee_name: user.employee_name,
      },

      JWT_SECRET,
      { expiresIn: "3h" }
    );
    res.json({ token });
  } catch (err) {
    console.error("Feil under innlogging:", err);
    res.status(500).json({ message: "Serverfeil" });
  }
});

export default router;
