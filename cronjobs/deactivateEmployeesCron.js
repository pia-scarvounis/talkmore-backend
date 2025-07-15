import cron from "node-cron";
import pool from "../config/db.js";
import platformClient from "purecloud-platform-client-v2";
import { getOAuthToken } from "../apiGenesysAuth/authTokenGenesys.js";

// CRON JOB hvis en ansatt får en slutt dato skal den settes til is_active = false (1) i sql
//Da skal dette også oppdateres i api genesys med hjelpe av genesys_user_id
console.log("[CRON] deactivateEmployeesCron.js er lastet inn");

//API GENESYS
const apiInstance = platformClient.ApiClient.instance;
const usersApi = new platformClient.UsersApi();

//CRON JOB hver hver uke, mnd , år , kl 23 ('0 23 * * *')//tester med 5 minutter nå ('*/5 * * * *')
cron.schedule("*/5 * * * *", async () => {
  console.log("[CRON] Starter deaktivering av ansatte med slutt dato");
  try {
    //Henter ansatt fra databasen med end_date = dagens dato
    const [employees] = await pool.query(`
            SELECT employee_id, end_date, genesys_user_id
            FROM employee
            WHERE end_date IS NOT NULL AND end_date <= CURDATE() AND is_active = 1  
        `);

    //Hvis ingen ansatte i databasen med slutt dato
    if (employees.length === 0) {
      console.log("[CRON] Ingen ansatte å deaktivere idag");
      return;
    }

    //HENTER genesys token
    const accessTokenGen = await getOAuthToken();
    apiInstance.setAccessToken(accessTokenGen);

    for (const emp of employees) {
      const { employee_id, end_date, genesys_user_id } = emp;

      console.log(
        `[CRON] Deaktiverer employee_id ${employee_id}, end_date:${end_date} `
      );

      //Oppdaterer den ansatt som har slutt dato og er aktiv til å ikke være aktiv
      await pool.query(
        `UPDATE employee SET is_active = 0 WHERE employee_id = ?`,
        [employee_id]
      );

      //oppdaterer lisenser og fjerner lisenser fra  ansatt med slutt dato idag
      await pool.query(
        `DELETE FROM employee_license WHERE employee_id = ?`,
        [employee_id]
        );

        console.log(`[CRON] Fjernet alle lisenser for employee_id ${employee_id}`);


        ///API GENESYS -- endirng av state i genesys 
      //MÅ kommentere ut genesys mellomtiden har ikke tilgang til til endre i genesys enda
      /** 
            if(genesys_user_id){
                try{

                    //henter eksisterende ansatt fra Genesys
                    const currentUser = await usersApi.getUser(genesys_user_id);

                    const updatedUser = {
                        state: 'inactive',
                        version: currentUser.version
                    };
                    //bruker patch for å oppdatere state på ansatt (updatedUser) i genesys
                    await usersApi.patchUser(genesys_user_id,updatedUser );

                    console.log(`[CRON] Deaktivert Genesys-testansatt ${genesys_user_id}`);

                    //oppdaterere geneesys_version i databasen 
                    await pool.query(`
                        UPDATE  employee SET genesys_version = ? WHERE employee_id = ? 
                    `, [currentUser.version, employee_id]);

                }catch(geneesysError){
                    console.error(`[CRON] Feil ved oppdatering i genesys for ${genesys_user_id}`, geneesysError.message);
                }
            

            }else{
                console.log(`[CRON] Ingen genesys_user_id registertert for employee ${employee_id}`);
            }
             */
    }
  } catch (err) {
    console.error("[CRON] Generell feil under deaktivering:", err);
  }
});
