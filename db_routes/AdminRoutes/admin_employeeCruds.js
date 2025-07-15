import { Router } from "express";
import dotenv from "dotenv";
import pool from "../../config/db.js";
import axios from "axios";
//henter passord og bcrypt for admin/teamleder passord
import bcrypt from "bcrypt";
import { DEFAULT_TEST_PASSWORD } from "../../config/config.js";
//API genesys
import platformClient from "purecloud-platform-client-v2";
//Token for API genesys
import { getOAuthToken } from "../../apiGenesysAuth/authTokenGenesys.js";
//henter full employe detaljer fra backend
import { getFullEmployeeById } from "../../Funksj_stotte/getFullEmpUpdatet.js";
//Henter rolle håndtering logikk for endring av rolle
import { handleUserRoleChange } from "../../Funksj_stotte/roleManagerInUpdate.js";
//middleware admin rute skal settes i router 
import { authenticateToken, requireAdmin } from "../../AuthenticateUsers/AuthMiddleware.js";

const router = Router();
dotenv.config();

//Kilder + tips til å endre ansatt i api genesys er fra GPT
const apiInstance = platformClient.ApiClient.instance;
const usersApi = new platformClient.UsersApi();

//Formatere dato
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split("T")[0];
};
//Benytter transaction: 1. da det er avhengige tabeller fra db og oppretter rader i mange tabeller
//Benytter transaction: 2. uten kan man få en ansatt uten tilhørende data (felter som pårørende, relative og lisenser)

//Ruter for å endre en ansatt og sette endringene og verdiene i historikken til den endrede ansatte
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  //ny info fra body
  const updatedData = req.body;

  console.log("TOKEN payload (req.user):", req.user);

  const adminId = req.user?.userId; //hente fra middleware senere men får nå henter admin id fra databasen employee_id 7 er admin
  console.log("adminId brukt i query:", adminId);

  if (!updatedData || typeof updatedData !== "object") {
    return res.status(400).json({ error: "Ingen data å oppdatere" });
  }
  console.log("Request body:", req.body);

  //må legge inn transasksjon for å rullere tilbake om feil og ungå feil i duplikat av epost -gpt
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingResult] = await conn.query(
      `SELECT * FROM employee WHERE employee_id = ?`,
      [id]
    );
    if (existingResult.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Ansatt ikke funnet" });
    }
    //henter originale ansatte er de ansatte som finnes i employee tabellen /før endring
    //Hvis ikke epost blir endret
    const original = existingResult[0];
    //Sjekk epost så man ikke får duplikat i endringen eller om epost ikke er endret
    //fikse dynamisk oppdatering
    const fields = [];
    const values = [];

    const originalEpost = (original.epost || "").trim().toLowerCase();

    const newEpost = (updatedData.epost || original.epost || "").toLowerCase();

    console.log("Epost-sjekk:");
    console.log("Ny epost (trim/lower):", newEpost);
    console.log("Original epost (trim/lower):", originalEpost);
    console.log("Employee ID:", id);

    if (newEpost && newEpost !== (originalEpost || "").toLowerCase()) {
      const [emailCheck] = await conn.query(
        `SELECT employee_id FROM employee WHERE epost = ? AND employee_id != ?`,
        [newEpost, Number(id)]
      );
      if (emailCheck.length > 0) {
        await conn.rollback();
        return res
          .status(400)
          .json({ error: "Eposten er allerede i bruk av en annen ansatt" });
      } else {
        fields.push("epost = ?");
        values.push(newEpost);
      }
    }
    // Sjekk og legg til navn
    if (
      updatedData.employee_name &&
      updatedData.employee_name !== original.employee_name
    ) {
      fields.push("employee_name = ?");
      values.push(updatedData.employee_name);
    }

    //hjelp med gpt oppsette for verdier string og date
    const normalize = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "string") return val.trim() || null;
      if (val instanceof Date) return val.toISOString().split("T")[0];
      return String(val);
    };

    // Legg til andre felter som har blitt endret unntatt
    //permisjon skal håndteres for seg da det ikke er i employee tabellen
    const keysToCheck = [
      "epost_Telenor",
      "phoneNr",
      "birthdate",
      "image_url",
      "start_date",
      "end_date",
      "form_of_employeement",
      "employeeNr_Talkmore",
      "employeeNr_Telenor",
      "employee_percentages",
      "team_id",
      "workPosistion_id",
    ];

    //lage keys for changeLog, kun disse skal settes i changeLog (permisjon kommer i egen)
    const keysToLog = [
      "start_date",
      "end_date",
      "form_of_employeement",
      "employee_percentages",
      "employeeNr_Talkmore",
      "employeeNr_Telenor",
      "team_id",
      "workPosistion_id",
    ];

    //for loop setter inn fields
    for (const key of keysToCheck) {
      const newValue = updatedData[key];
      const originalValue = original[key];

      const normNew = normalize(newValue);
      const normOld = normalize(originalValue);
      //newValue !== undefined && String(newValue) !== String(originalValue)

      if (normNew !== normOld) {
        if (keysToLog.includes(key)) {
          let displayOld = normOld;
          let displayNew = normNew;

          //henter tidligere team navn basert på team id før endring
          if (key === "team_id") {
            if (normOld) {
              const [[oldTeam]] = await conn.query(
                `SELECT team_name FROM team WHERE team_id = ?`,
                [normOld]
              );
              displayOld = oldTeam?.team_name || normOld;
            }
            //ny team navn
            if (normNew) {
              const [[newTeam]] = await conn.query(
                `SELECT team_name FROM team WHERE team_id = ?`,
                [normNew]
              );
              displayNew = newTeam?.team_name || normNew;
            }
          }
          //Henter stilling navn basert på id før endring
          if (key === "workPosistion_id") {
            if (normOld) {
              const [[oldPosistion]] = await conn.query(
                `SELECT posistion_title FROM workPosistion WHERE workPosistion_id = ?`,
                [normOld]
              );
              displayOld = oldPosistion?.posistion_title || normOld;
            }
            //ny stilling navn
            if (normNew) {
              const [[newPosistion]] = await conn.query(
                `SELECT posistion_title FROM workPosistion WHERE workPosistion_id = ?`,
                [normNew]
              );
              displayNew = newPosistion?.posistion_title || normNew;
            }
          }
          
          await conn.query(
            `INSERT INTO changeLog (
                        employee_id, admin_id,
                        field_changed, old_value, new_value, change_date
                    )
                    VALUES (?, ?, ?, ?, ?, NOW())`,
            [id, adminId, key, displayOld ?? "NULL", displayNew ?? "NULL"]
          );
          fields.push(`${key} = ?`);
          values.push(newValue ?? null);
        }
      }
    }

    //Pusher endringene i employee
    if (fields.length > 0) {
      const sql = `UPDATE employee
                SET ${fields.join(", ")}
                WHERE employee_id = ?`;

      values.push(id);
      await conn.query(sql, values);
      console.log("Ansatt oppdatert");
    } else {
      console.log("Ingen endringer i employee");
    }

    //Oppdater pårørende (relative)
    if (Array.isArray(updatedData.relative)) {
      //Fjerner tidligere relativ maks 1 pårørende per ansatt
      await conn.query(`DELETE FROM relative WHERE employee_id = ?`, [id]);
      for (const r of updatedData.relative) {
        await conn.query(
          `INSERT INTO relative (employee_id, relative_name, relative_phoneNr)
                    VALUES (?, ?, ?)`,
          [id, r.relative_name, r.relative_phoneNr]
        );
      }
    }

    //oppdaterer permisjon samt hvis endret sett inn i changeLog
    // Oppdater permisjon
    const [existingLeave] = await conn.query(
      `SELECT * FROM employeeLeave WHERE employee_id = ?`,
      [id]
    );
    const updatedLeave = updatedData.leave;

    //setter det i variabel istedenfor mht til changelog logikk -gpt
    const normOldPercentage = normalize(existingLeave[0]?.leave_percentage);
    const normNewPercentage = normalize(updatedLeave.leave_percentage);
    const normOldStart = normalize(existingLeave[0]?.leave_start_date);
    const normNewStart = normalize(updatedLeave.leave_start_date);
    const normOldEnd = normalize(existingLeave[0]?.leave_end_date);
    const normNewEnd = normalize(updatedLeave.leave_end_date);

    let changed = false;

    if (updatedLeave) {
      //setter changed som ikke lik eksisterende verdi
      changed =
        normOldPercentage !== normNewPercentage ||
        normOldStart !== normNewStart ||
        normOldEnd !== normNewEnd;

      //hvis endret slette den andre eksisterende verdien fra permisjon tabellen og sett inn de nye verdiene
      if (changed) {
        await conn.query(`DELETE FROM employeeLeave WHERE employee_id = ?`, [
          id,
        ]);
        //sett den nye verdien i permisjon tabellen
        await conn.query(
          `INSERT INTO employeeLeave (employee_id, leave_percentage, leave_start_date, leave_end_date) VALUES (?, ?, ?, ?)`,
          [
            id,
            updatedLeave.leave_percentage || null,
            updatedLeave.leave_start_date || null,
            updatedLeave.leave_end_date || null,
          ]
        );

        //deretter setter dette seg i changelog hvis endret

        await conn.query(
          `INSERT INTO changeLog (employee_id, admin_id, field_changed, old_value, new_value, change_date)
                VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            id,
            adminId,
            "leave",
            normOldPercentage
              ? `${normOldPercentage}% fra ${normOldStart} til ${normOldEnd}`
              : "Ingen",
            normNewPercentage
              ? `${normNewPercentage}% fra ${normNewStart} til ${normNewEnd}`
              : "Ingen",
          ]
        );
      }
    }

    //oppdatere lisenser for ansatt
    if (Array.isArray(updatedData.licenses)) {
      //fjerner lisenser og setter inn nye
      await conn.query(`DELETE FROM employee_license WHERE employee_id = ?`, [
        id,
      ]);
      for (const license of updatedData.licenses) {
        await conn.query(
          `INSERT INTO employee_license (employee_id, license_id)
                    VALUES (?, ?)`,
          [id, license.license_id]
        );
      }
    }
  
    //Oppdatere ansatt i api genesys hvis endring i navn eller epost
    //genesys_user_id link mellom api og databasen
    //Må kommentere ut hvis genesys logikk , feiler hvis man ikke har genesys nøkler
    /**
    if (original.genesys_user_id) {
      //henter inn token
      const accessTokenGen = await getOAuthToken();
      console.log("AccessToken hentet fra Genesys:", accessTokenGen);
      apiInstance.setAccessToken(accessTokenGen);

      try {
        //må hente bruker før vi setter den i update user
        const currentUser = await usersApi.getUser(original.genesys_user_id);
        console.log(
          "Genesys User ID vi prøver å oppdatere",
          original.genesys_user_id
        );

        const updateUser = {
          name: updatedData.employee_name || currentUser.name,
          email: updatedData.epost || currentUser.email,
          version: currentUser.version,
        };
        console.log("Oppdateringsdata som sendes til Genesys:", updateUser);

        //variabel som holder på den oppdaterte ansatte
        const updatedUser = await usersApi.patchUser(currentUser, updateUser);
        //oppdater genesys_verision id i databasen med den oppdaterte verdien i version
        await conn.query(
          `
                UPDATE employee
                SET genesys_version = ?
                WHERE employee_id = ?
            `,
          [updatedUser.version, id]
        );

        console.log(`Oppdatert i Genesys: ${currentUser}`);
      } catch (genesysError) {
        console.error("Feil ved oppdatering i Genesys", genesysError);
      }
    }
    */
    //returnere oppdatert ansatt med hjelpefunksjonen getfullemployeebyid sender inn conn som argument
    //Ikke anbefalt å opprette ny conn i getFullEmployeeById
    const updatedEmployee = await getFullEmployeeById(conn, id);

    //sjekk hvis ansatt stilling blir endret fra eller til Admin/teamleder
    //Eller ansatt har fått admin/teamleder rolle
    //Setter inn verdiene i handleUserRoleChange
    await handleUserRoleChange(
      conn,
      id,
      original.workPosistion_id,
      updatedData.workPosistion_id,
      updatedData.epost
    );

    await conn.commit();

    res.status(200).json({
      message: "Ansatt, pårørendende, permisjon og genesys oppdatert",
      employee: updatedEmployee,
    });
  } catch (err) {
    await conn.rollback();
    console.error("Feil ved oppdatering av ansatt:", err);
    res.status(500).json({ error: "Kunne ikke oppdatere ansatt" });
  } finally {
    conn.release();
  }
});

//Opprette en ansatt // Vi skal ikke sette dette opp i api genesys da det er på vent
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  // henter employee fra body
  const newEmployee = req.body;

  //bytter ut pool med vaiarbel coon bruker pool.getConnection
  const conn = await pool.getConnection();

  try {
    //starter transaksjon
    await conn.beginTransaction();

    console.log("Request body:", req.body);

    //sjekker om epost finnes fra før employee tabellen kan ikke bruke den
    if (newEmployee.epost) {
      const [emailCheck] = await conn.query(
        `SELECT employee_id FROM employee WHERE epost = ?`,
        [newEmployee.epost.toLowerCase()]
      );
      if (emailCheck.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: "Eposten er allerede i bruk" });
      }
    }

    //Setter inn resultat fra body i employee tabellen
    const [result] = await conn.query(
      `INSERT INTO employee (
                employee_name, epost, epost_Telenor, phoneNr, birthdate, image_url,
                start_date, end_date, form_of_employeement, employeeNr_Talkmore, employeeNr_Telenor,
                employee_percentages, team_id, workPosistion_id
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
      [
        newEmployee.employee_name,
        newEmployee.epost?.toLowerCase() || null,
        newEmployee.epost_Telenor || null,
        newEmployee.phoneNr || null,
        formatDate(newEmployee.birthdate),
        newEmployee.image_url || null,
        formatDate(newEmployee.start_date),
        formatDate(newEmployee.end_date),
        newEmployee.form_of_employeement || null,
        newEmployee.employeeNr_Talkmore || null,
        newEmployee.employeeNr_Telenor || null,
        newEmployee.employee_percentages || null,
        newEmployee.team_id || null,
        newEmployee.workPosistion_id || null,
      ]
    );
    //henter resultat insert it fra nye ansatt setter det inn for andre felter som relative, permisjon og lisenser
    const employeeId = result.insertId;

    //legger til pårørende
    if (Array.isArray(newEmployee.relative)) {
      for (const r of newEmployee.relative) {
        await conn.query(
          `INSERT INTO relative (employee_id, relative_name, relative_phoneNr)
                    VALUES (?, ?, ?)`,
          [employeeId, r.relative_name, r.relative_phoneNr]
        );
      }
    }

    //Legger til permisjon - selvom man ikke kan legge til permisjon i frontend feltene trenger vi et tomt felt array for denne
    //mulig setter fjerner denne?
    if (newEmployee.leave) {
      await conn.query(
        `INSERT INTO employeeLeave (employee_id, leave_percentage, leave_start_date, leave_end_date)
                VALUES (?, ?, ?, ?)`,
        [
          employeeId,
          newEmployee.leave.leave_percentage || null,
          formatDate(newEmployee.leave.leave_start_date),
          formatDate(newEmployee.leave.leave_end_date),
        ]
      );
    }

    //Legge til Lisenser
    if (Array.isArray(newEmployee.licenses)) {
      for (const license of newEmployee.licenses) {
        await conn.query(
          `INSERT INTO employee_license (employee_id, license_id)
                    VALUES (?, ?)`,
          [employeeId, license.license_id]
        );
      }
    }
    // henter nye ansatt som er opprettet med employeeId
    let createdEmployee = await getFullEmployeeById(conn, employeeId);

    //sette tom felt som ikke er med i opprettelsen av ansatt
    createdEmployee.relative = createdEmployee.relative || [];
    createdEmployee.leave = createdEmployee.leave || [];
    createdEmployee.licenses = createdEmployee.licenses || [];

    //Sette inn logikk for hvis newEmployee blir Admin/teamleder sett det inn i userOfTool med kryptert passord
    //Hente workPosistion_title for sjekken
    const [workPosistionResult] = await conn.query(
      `SELECT posistion_title FROM workPosistion WHERE workPosistion_id = ?`,
      [newEmployee.workPosistion_id]
    );
    const workTitle = workPosistionResult[0]?.workPosistion_title || "";
    //sjekker om newEmployee er Admin/teamleder
    if (["Admin", "Teamleder"].includes(workTitle)) {
      const hashedPassword = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);

      //Hvis admin eller teamleder settes det inn i userOfTool db
      await conn.query(
        `INSERT INTO userOfTool(roles, username, password_hash, employee_id)
                VALUES(?, ?, ?, ?)`,
        [workTitle, newEmployee.epost.toLowerCase(), hashedPassword, employeeId]
      );
      console.log(`${workTitle} bruker opprettet i userOfTool`);
    }

    await conn.commit();

    res.status(201).json({
      message: "Ny ansatt opprettet",
      employee: createdEmployee,
    });
  } catch (err) {
    await conn.rollback();
    console.error("Feil ved oppretting av ansatt;", err);
    res.status(500).json({ error: "Kunne ikke opprette ansatt" });
  } finally {
    conn.release();
  }
});

export default router;
