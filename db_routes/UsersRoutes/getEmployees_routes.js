import { Router } from "express";
import dotenv from "dotenv";
import pool from "../../config/db.js";
import axios from "axios";
import bcrypt from 'bcrypt';
// Hvis ikke genesys brukes det mockdata
import {getMockGenesysEmployees}from '../../Funksj_stotte/mockGenesysData.js';
//Token for API genesys
import {getOAuthToken} from '../../apiGenesysAuth/authTokenGenesys.js';
//vi skal importere en autentisering middleware for alle brukere av vårt verktøy
//Disse rutene skal gjelde for begge brukere av vårt verktøy (admin + teamleder)
//Så det krever at vi setter inn authmiddleware i rutene her som sjekker om brukeren
//har tilgang til ruterene dette kommer senere!!


//middleware
import { authenticateToken, requireTeamLeaderOrAdmin } from "../../AuthenticateUsers/AuthMiddleware.js";

dotenv.config();

//Justere denne hente dette fra config!!
const DEFAULT_TEST_PASSWORD = process.env.DEFAULT_TEST_PASSWORD;
console.log('DEFAULT_TEST_PASSWORD:', process.env.DEFAULT_TEST_PASSWORD);

const router = Router();

//Denne sjekker hvilken database navn vi bruker
const [dbResult] = await pool.query("SELECT DATABASE() AS db");
console.log("Koden kjører mot databasen:", dbResult[0].db);


//Henter alle ansatte fra genesys api med token som parameter
async function fetchAllGenEmployees(token){
    let allGenEmployees = [];
    //Start uri, bruker next uri for å hente alle ansatte fra genesys uten å håndtere sidetelling
    let nextUri = '/api/v2/users?pageSize=25&pageNumber=1';

    while(nextUri){
        const response = await axios.get(`https://api.mypurecloud.de${nextUri}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }); 
        console.log('Genesys API respons:', response.data);
        //legger inn ansatte som er hentet til listen []
        allGenEmployees= allGenEmployees.concat(response.data.entities);
        // oppdaterer neste uri
        nextUri = response.data.nextUri;
    }
    return allGenEmployees;
}

//API Genesys implementasjon
//Hente ut alle brukere fra API genesys og hvis det ikke ligger i vår database, legg dem til.
//sammenligne email fra api med det som ligger i databasen epost 
//setter ikke midleware på denne da den skjer automatisk i bakgrunn i cronjob
router.post('/', async (req, res) => {
    try {

      // Hvis ikke Genesys nøkler eksisterer - bruk mockdata fallback
      const keysExist = process.env.CLIENT_ID && process.env.CLIENT_SECRET;
      let genesysApiEmployees = [];

      if(keysExist){
        const accessTokenGen = await getOAuthToken();
        genesysApiEmployees = await fetchAllGenEmployees(accessTokenGen);
        console.log('Antall ansatte hentet fra Genesys:', genesysApiEmployees.length);
      } else{
         //Hvis ikke nøkler eksisterer bruk mockdata
        console.warn('Genesys nøkler mangler, bruker mockdata for ansatte');
        genesysApiEmployees = getMockGenesysEmployees();
      }
  
      const formOptions = ['Fast', 'Innleid'];
      let currentAdminCount = 0;
      const teamLeadersAssigned = new Set();
  
      function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
      }
  
      const [allTeams] = await pool.query(`SELECT team_id FROM team`);
      const shuffledTeamIds = allTeams.map(t => t.team_id);
      shuffle(shuffledTeamIds);
  
      
      const employees = [];

      //henter team_id for performance management-teamet
      const [[{team_id: adminTeamId} = {}]] = await pool.query(
        `SELECT team_id FROM team WHERE team_name = 'Performance Management'`
      );
      
      let teamIndex = 0;
    
      //Maks 8 admin skal bli fordelt per testbruker, 1 teamleder per team, og resten tildeles kundeagenter
      //må bruke denne istedenfor promise da den fortsatte å hente inn nye admin og teamledere
      //bruker det fordi det krever en nøyaktig rekkefølge og kontroll på tildeling av tilstand
      //gpt for å justere promise
      for (const employee of genesysApiEmployees) {
        let team_id;

        do{
          team_id = shuffledTeamIds[teamIndex % shuffledTeamIds.length];
          teamIndex++;
        }while(team_id === adminTeamId && currentAdminCount >= 8);

      
        const [teamRows] = await pool.query('SELECT team_name FROM team WHERE team_id = ?', [team_id]);
        const team_name = teamRows[0]?.team_name || 'Ukjent team';

        //sjekker eksisterende ansatt om den finnes i databasen
        const [existing] = await pool.query(
          `SELECT employee_id, employee_name FROM employee WHERE epost = ?`, [employee.email]
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
  
        //Generer data for ny ansatt med randomisering i variabler 
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
  
        // Tildel rolle basert på logikk hjelp med gpt
        //MAKS 8 admin de skal tilhøre avdeling ADMIN og TEAM performance
        if(team_id === adminTeamId && currentAdminCount < 8){
          workPosistion_title = 'Admin';
          const [res] = await pool.query(`SELECT workPosistion_id FROM workPosistion WHERE posistion_title = 'Admin'`);
          workPosistion_id = res[0].workPosistion_id;
          currentAdminCount++;
          console.log(`Tildelt Admin. Totalt: ${currentAdminCount}/8`);

          //MAKS 1 teamleder per Team når det skal settes inn
        }else if(!teamLeadersAssigned.has(team_id)){
          workPosistion_title = 'Teamleder';
          const [res] = await pool.query(`SELECT workPosistion_id FROM workPosistion WHERE posistion_title = 'Teamleder'`);
          workPosistion_id = res[0].workPosistion_id;
          teamLeadersAssigned.add(team_id);
          console.log(`Tildelt Teamleder til team ${team_name}`);
        }else{
          //resten tildeles kundeagenter
          workPosistion_title = 'Kundeagent';
          const [res] = await pool.query(`SELECT workPosistion_id FROM workPosistion WHERE posistion_title = 'Kundeagent'`);
          workPosistion_id = res[0].workPosistion_id;
          employee_percentages = (Math.floor(Math.random() * 10) + 1) * 10;
          form_of_employeement = formOptions[Math.floor(Math.random() * formOptions.length)];
          console.log(`Tildelt Kundeagent til ${employee.name}`);
        }

        //Setter inn ny ansatt i databasen
        const [result] = await pool.query(
          `INSERT INTO employee (
            employee_name, epost, phoneNr, birthdate, image_url, start_date, end_date,
            form_of_employeement, employeeNr_Talkmore, employeeNr_Telenor,
            employee_percentages, is_test, is_active, team_id, workPosistion_id,
            team_name, workPosistion_title,
            genesys_user_id, genesys_version, genesys_self_uri
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            1,
            1,
            team_id,
            workPosistion_id,
            team_name,
            workPosistion_title,
            employee.id,
            employee.version,
            employee.selfUri
          ]
        );

        //legge til lisenser på alle testbrukere hentet fra api genesys 
        const employee_id = result.insertId;

        const[licenses] = await pool.query(` SELECT license_id FROM license`);
        for(const license of licenses){
          await pool.query(`
            INSERT INTO employee_license(employee_id, license_id) 
            VALUES (?, ?)
          `, [employee_id, license.license_id]
          );
        }
        //Admin og Teamledere blir satt inn i userOfTool tabellen
        if(workPosistion_title === 'Admin' || workPosistion_title === 'Teamleder'){
          const role = workPosistion_title === 'Admin' ? 'Admin' : 'Teamleder';

          //lager et kryptert passord, default passord ligger i env filen
          
          const testHashPassord = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);

          await pool.query(`
            INSERT INTO userOfTool (roles, username, password_hash, active, is_test, employee_id)
            VALUES (?, ?, ?, ?, ?, ?)`
            , [
              role,
              employee.email,
              testHashPassord,
              1,
              1,
              result.insertId
            ]);

        }
        //Dette er en midlertidig del da api genesys ikke har behov for tileggsopplysingene vi legger til
        employees.push({
          ...employee,
          dbId: result.id
        });
      }
  
      res.status(200).json(employees);
  
    } catch (err) {
      console.error('Feil i synkroniseringen:', err);
      console.error('Stack trace:', err.stack);
      res.status(500).json({ error: 'Noe gikk galt' });
    }
  });
  


// router for å fetche employees fra databasen vår
router.get('/', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
    try {
      //henter ut alt vi trenger i employee json objektet
      const [rows] = await pool.query(`
                SELECT 
                    employee.*,
                    relative.relative_id,
                    relative.relative_name,
                    relative.relative_phoneNr,
                    team.team_name,
                    team.department_id AS department_id,
                    department.department_name,
                    workPosistion.posistion_title as workPosistion_title,
                    l.license_id,
                    l.license_title,
                    leaveTbl.leave_id,
                    leaveTbl.leave_percentage,
                    leaveTbl.leave_start_date,
                    leaveTbl.leave_end_date
                FROM employee
                LEFT JOIN relative ON employee.employee_id = relative.employee_id
                LEFT JOIN team ON employee.team_id = team.team_id
                LEFT JOIN department ON team.department_id = department.department_id
                LEFT JOIN workPosistion ON employee.workPosistion_id = workPosistion.workPosistion_id
                LEFT JOIN employee_license el ON employee.employee_id = el.employee_id
                LEFT JOIN license l ON el.license_id = l.license_id
                LEFT JOIN employeeLeave leaveTbl ON employee.employee_id = leaveTbl.employee_id
                WHERE employee.is_active = 1
                `);
 
                if (rows.length === 0) {
                    return res.status(404).json({ message: 'Ingen ansatte funnet' });
                }
 
            // Gruppér ansatte + relatives + lisens + permisjon som en array // returnerer riktig result objekt /hjlep med gpt
            const groupedEmployees = rows.reduce((acc, row) => {
                const {
                    employee_id,
                    relative_id,
                    relative_name,
                    relative_phoneNr,
                    license_id,
                    license_title,
                    leave_id,
                    leave_percentage,
                    leave_start_date,
                    leave_end_date,
                    department_id,
                    ...employeeData
                    } = row;
 
                if (!acc[employee_id]) {
                acc[employee_id] = {
                employee_id,
                ...employeeData,
                department_id,
                relative: [],
                licenses: [],
                leave: null //Hvis ansatt ikke har noen permisjon
                };
            }
            //hvis pårørende
            if (relative_id) {
                acc[employee_id].relative.push({
                  relative_id,
                  relative_name,
                  relative_phoneNr
                });
              }
            //Hvis lisens
            if(license_id && license_title){
                //sjekker om lisens finnes og ikke får duplikater i lisenser
                const existingLicense = acc[employee_id].licenses.find(l => l.license_id === license_id);
                if(!existingLicense){
                  acc[employee_id].licenses.push({
                    license_id,
                    license_title: license_title
                  });
                }
              }
              //Hvis permisjon
              if(leave_id && !acc[employee_id].leave){
                acc[employee_id].leave = {
                  leave_id,
                  leave_percentage,
                  leave_start_date,
                  leave_end_date
                };
              }
              
              return acc;
            }, {});

    
      res.status(200).json(Object.values(groupedEmployees));
    } catch (err) {
      console.error('Feil ved henting av ansatte fra databasen:', err);
      res.status(500).json({ message: 'Noe gikk galt', error: err.message });
    }
  });
  


export default router;