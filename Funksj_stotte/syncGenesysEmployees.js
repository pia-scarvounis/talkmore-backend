import dotenv from 'dotenv';
import pool from '../config/db.js'; // Justér sti hvis nødvendig
import bcrypt from 'bcrypt';
import axios from 'axios';
import { getOAuthToken } from '../apiGenesysAuth/authTokenGenesys.js';
//Hvis ikke nøkler til genesys kjør mockdata automatisk hvis mockdata epost ikke eksisterer fra før
import { getMockGenesysEmployees } from './mockGenesysData.js';


dotenv.config();
//Dette er funksjon for å sjekke om nye ansatte fra genesys er i databasen eller ikke skal sette i cron job
const DEFAULT_TEST_PASSWORD = process.env.DEFAULT_TEST_PASSWORD;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function fetchAllGenEmployees(token) {
  let allGenEmployees = [];
  let nextUri = '/api/v2/users?pageSize=25&pageNumber=1';

  while (nextUri) {
    const response = await axios.get(`https://api.mypurecloud.de${nextUri}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    allGenEmployees = allGenEmployees.concat(response.data.entities);
    nextUri = response.data.nextUri;
  }

  return allGenEmployees;
}

export async function syncGenesysEmployees() {
  try {
    // Hvis ikke Genesys nøkler eksisterer - bruk mockdata fallback
    const keysExist = process.env.CLIENT_ID && process.env.CLIENT_SECRET;
    let genesysApiEmployees = [];

    if(keysExist){
      const token = await getOAuthToken();
      genesysApiEmployees = await fetchAllGenEmployees(token);
      console.log('[DEBUG] Antall ansatte hentet:', genesysApiEmployees.length);
    }else{
      //Hvis ikke nøkler eksisterer bruk mockdata
      console.warn('Genesys nøkler mangler, bruker mockdata for ansatte');
      genesysApiEmployees = getMockGenesysEmployees();
    }
    
    const formOptions = ['Fast', 'Innleid'];
    let currentAdminCount = 0;
    const teamLeadersAssigned = new Set();

    const [allTeams] = await pool.query(`SELECT team_id FROM team`);
    const shuffledTeamIds = allTeams.map(t => t.team_id);
    shuffle(shuffledTeamIds);

    const [[{ team_id: adminTeamId } = {}]] = await pool.query(
      `SELECT team_id FROM team WHERE team_name = 'Performance Management'`
    );

    const employees = [];
    let teamIndex = 0;

    for (const employee of genesysApiEmployees) {
      let team_id;
      do {
        team_id = shuffledTeamIds[teamIndex % shuffledTeamIds.length];
        teamIndex++;
      } while (team_id === adminTeamId && currentAdminCount >= 8);

      const [teamRows] = await pool.query('SELECT team_name FROM team WHERE team_id = ?', [team_id]);
      const team_name = teamRows[0]?.team_name || 'Ukjent team';

      const [existing] = await pool.query(
        `SELECT employee_id, employee_name FROM employee WHERE epost = ?`,
        [employee.email]
      );

      if (existing.length > 0) {
        const employee_id = existing[0].employee_id;
        const [relative] = await pool.query(`SELECT * FROM relative WHERE employee_id = ?`, [employee_id]);

        employees.push({
          ...employee,
          ...existing[0],
          relative: relative || []
        });
        continue;
      }

      const randomPhone = `+47${Math.floor(10000000 + Math.random() * 8999999)}`;
      const randomBirthday = () => new Date(1980 + Math.random() * 21, Math.random() * 12, Math.floor(Math.random() * 28) + 1)
        .toISOString().split('T')[0];
      const birthdate = randomBirthday();
      const randomStartDate = () => new Date(2010, 0, 1 + Math.floor(Math.random() * 4000)).toISOString().split('T')[0];
      const start_date = randomStartDate();

      const employeNr_TM = Math.floor(Math.random() * 9000) + 1000;
      const employeNr_TN = Math.floor(Math.random() * 9000) + 1000;

      let workPosistion_title = '';
      let workPosistion_id = '';
      let form_of_employeement = 'Fast';
      let employee_percentages = 100;

      if (team_id === adminTeamId && currentAdminCount < 8) {
        workPosistion_title = 'Admin';
        const [res] = await pool.query(`SELECT workPosistion_id FROM workPosistion WHERE posistion_title = 'Admin'`);
        workPosistion_id = res[0].workPosistion_id;
        currentAdminCount++;
      } else if (!teamLeadersAssigned.has(team_id)) {
        workPosistion_title = 'Teamleder';
        const [res] = await pool.query(`SELECT workPosistion_id FROM workPosistion WHERE posistion_title = 'Teamleder'`);
        workPosistion_id = res[0].workPosistion_id;
        teamLeadersAssigned.add(team_id);
      } else {
        workPosistion_title = 'Kundeagent';
        const [res] = await pool.query(`SELECT workPosistion_id FROM workPosistion WHERE posistion_title = 'Kundeagent'`);
        workPosistion_id = res[0].workPosistion_id;
        employee_percentages = (Math.floor(Math.random() * 10) + 1) * 10;
        form_of_employeement = formOptions[Math.floor(Math.random() * formOptions.length)];
      }

      const [result] = await pool.query(
        `INSERT INTO employee (
          employee_name, epost, phoneNr, birthdate, image_url, start_date, end_date,
          form_of_employeement, employeeNr_Talkmore, employeeNr_Telenor,
          employee_percentages, is_test, team_id, workPosistion_id,
          team_name, workPosistion_title,
          genesys_user_id, genesys_version, genesys_self_uri
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        employee.name,
        employee.email,
        randomPhone,
        birthdate,
        null,
        start_date,
        null,
        form_of_employeement,
        employeNr_TM,
        employeNr_TN,
        employee_percentages,
        true,
        team_id,
        workPosistion_id,
        team_name,
        workPosistion_title,
        employee.id,
        employee.version,
        employee.selfUri
      ]);

      const employee_id = result.insertId;
      const [licenses] = await pool.query(`SELECT license_id FROM license`);

      for (const license of licenses) {
        await pool.query(`
          INSERT INTO employee_license(employee_id, license_id) 
          VALUES (?, ?)`, [employee_id, license.license_id]);
      }

      if (workPosistion_title === 'Admin' || workPosistion_title === 'Teamleder') {
        const role = workPosistion_title;
        const testHashPassord = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);

        await pool.query(`
          INSERT INTO userOfTool (roles, username, password_hash, active, is_test, employee_id)
          VALUES (?, ?, ?, ?, ?, ?)`, [
          role,
          employee.email,
          testHashPassord,
          true,
          true,
          employee_id
        ]);
      }

      employees.push({
        ...employee,
        dbId: employee_id
      });
    }

    return employees;

  } catch (err) {
    console.error('[SYNC] Feil under synkronisering:', err);
    throw err;
  }
}
