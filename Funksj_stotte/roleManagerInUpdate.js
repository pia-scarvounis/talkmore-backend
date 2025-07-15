import bcrypt from "bcrypt";
import { DEFAULT_TEST_PASSWORD } from "../config/config.js";

//Denne filen inneholder logikk og sjekker for oppdatering av ansatt / støttefunksjon
//Når en admin endrer en ansatt fra Admin/Teamleder eller til Admin/Teamleder
//Eller hvis uhell skjer med at en ansatt har fått admin rolle og det skulle være Kundeagent

const privelegedRoles = ["admin", "teamleder"];

export async function handleUserRoleChange(
  conn,
  employeeId,
  originalPosId,
  newPosId,
  epost
) {
  const [posData] = await conn.query(
    //Finner stillingstittel Admin og Teamleder fra employee_id (employeeId)
    `SELECT workPosistion_id, posistion_title
        FROM workPosistion
        WHERE workPosistion_id IN (?, ?)`,
    [originalPosId, newPosId]
  );
  console.log('PosData hentet fra workPosition-tabellen:', posData);


  //Eldre tittel før endring, setter data
  const oldTitle = (posData.find(p => Number(p.workPosistion_id) === Number(originalPosId))?.posistion_title || '').toLowerCase();
  //Ny tittel
  const newTitle = (posData.find(p => Number(p.workPosistion_id) === Number(newPosId))?.posistion_title || '').toLowerCase();

    console.log('Rolle-endring:', { oldTitle, newTitle });
  //hvis rolle = har tilgang
  const isPrivileged = (roles) => privelegedRoles.includes(roles);

  //finner eksisterende ansatt i userOfTool
  const [existingUser] = await conn.query(
    `SELECT * FROM userOfTool 
        WHERE employee_id = ?`,
    [employeeId]
  );
  const userExist = existingUser.length > 0;

   //krypterer passord
   const hashedPassword = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);

  //Sjekker rolle/stillingstittel
  //Hvis en ansatt får ny Admin/Teamleder stllingtittel i endringene etc.
  if (isPrivileged(newTitle)) {
    if (userExist) {

      //Hvis ansatt eksisterer i userOfTool fra tidligere med aktivert false etc.
      //Eller oppdatert andre felter for admin/teameder som epost/brukernavn
      //oppdaterer passord hvis null ved endring til Teamleder/admin
      await conn.query(
        `UPDATE userOfTool
                SET active = 1, roles = ?, password_hash = COALESCE(password_hash, ?),
                username = COALESCE(username, ?)
                WHERE employee_id = ?`,
        [newTitle, hashedPassword, epost?.toLowerCase(), employeeId]
      );
        console.log(`[userOfTool]Eksisterende bruker oppdatert og aktivert ${newTitle}`);
      //hvis ikke bruker finnes fra før i userOfTool
    } else {
      await conn.query(
        `INSERT INTO userOfTool (roles, username, password_hash, active, is_test, employee_id)
                VALUES (?, ?, ?, 1, 1, ?)`,
        [newTitle, epost?.toLowerCase(), hashedPassword, employeeId]
      );
    }
    console.log(`${newTitle} bruker opprettet`);

    //hvis ansatt får ny stillingstittel som ikke er admin/teamleder
  } else if(userExist && !isPrivileged(newTitle)){
    
      //oppdater bruker og sette active til false = ingen admin/teamleder rettigheter
      await conn.query(
        `UPDATE userOfTool
              SET active = 0
              WHERE employee_id = ?`,
        [employeeId]
      );
      console.log("Bruker av verktøy deaktivert");
    
  }else{
    console.log('[userOfTool] ingen tiltak')
  }
}
