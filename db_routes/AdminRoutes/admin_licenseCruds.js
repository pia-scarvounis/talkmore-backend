// Express Router for å administrere lisenser
import { Router } from "express";
import dotenv from "dotenv";
import pool from "../../config/db.js";
import {
  authenticateToken,
  requireAdmin,
} from "../../AuthenticateUsers/AuthMiddleware.js";

dotenv.config();
const router = Router();

// Legg til ny lisens
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  const { license_title } = req.body;

  if (!license_title) {
    return res.status(400).json({ message: "Lisens tittel er påkrevd" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO license (license_title) VALUES (?)`,
      [license_title]
    );
    res.status(201).json({
      success: true,
      message: "Lisens opprettet",
      data: {
        license_id: result.insertId,
        license_title,
      },
    });
  } catch (err) {
    console.error("[POST /license] Feil:", err);
    res.status(500).json({ message: "Feil ved oppretting av lisens" });
  }
});

// Oppdater lisens
router.put("/:licenseId", authenticateToken, requireAdmin, async (req, res) => {
  const { licenseId } = req.params;
  const { license_title } = req.body;

  if (!license_title) {
    return res.status(400).json({ message: "Lisens tittel er påkrevd" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE license SET license_title = ? WHERE license_id = ?`,
      [license_title, licenseId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Fant ikke lisens med oppgitt ID" });
    }

    res.status(200).json({ message: "Lisens oppdatert" });
  } catch (err) {
    console.error("[PUT /license/:licenseId] Feil:", err);
    res.status(500).json({ message: "Feil ved oppdatering av lisens" });
  }
});

// Slett lisens
router.delete(
  "/:licenseId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { licenseId } = req.params;

    try {
      const [result] = await pool.query(
        `DELETE FROM license WHERE license_id = ?`,
        [licenseId]
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Fant ikke lisens med oppgitt ID" });
      }

      res.status(200).json({ message: "Lisens slettet" });
    } catch (err) {
      console.error("[DELETE /license/:licenseId] Feil:", err);
      res.status(500).json({ message: "Feil ved sletting av lisens" });
    }
  }
);

export default router;
