import { application, json, Router } from "express";
import dotenv from "dotenv";
import pool from "../../config/db.js";

//middleware for ruten enten admin eller teamleder(leserolle) 
import { authenticateToken, requireTeamLeaderOrAdmin } from "../../AuthenticateUsers/AuthMiddleware.js";


dotenv.config();

const router = Router();


// Denne ruterene skal hente total oversikt på antall ansatte samt fte
//Den skal droppe ansatte som har permisjon eller har sluttet i visningen og fte
//selv om en ansatt er 30% skal den vises her og beregnes
//Vi har en annen ruter som skal vise faktiske ansatte som innlogget/på jobb

router.get('/dayOverviewEmployees', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) =>{

    try{

        const selectedDate = req.query.date ? new Date(req.query.date) : new date();
        const dateString = selectedDate.toISOString().split('T')[0];

        //Henter ut rader for ansatt info og joiner med jobbtittel, teamtilhørighet og permisjon for ansatt
        const [rows] = await pool.query(`
            SELECT
                e.employee_id,
                e.employee_name,
                e.epost,
                e.birthdate,
                e.form_of_employeement,
                e.employee_percentages,
                e.employeeNr_Talkmore,
                e.employeeNr_Telenor,
                e.end_date,
                wp.posistion_title AS workPosistion_title,
                t.team_name,
                l.leave_start_date,
                l.leave_end_date
            FROM employee e
            LEFT JOIN workPosistion wp ON e.workPosistion_id = wp.workPosistion_id
            LEFT JOIN team t ON e.team_id = t.team_id
            LEFT JOIN employeeLeave l ON e.employee_id = l.employee_id
            
        `);

        //filtrere ut ansatte som har permisjon eller har sluttet de skal ikke vises som del av 
        //FTE ansatt  
       

        const result = rows.filter(row =>{
            //valgte dato på dashbord
            const selected = new Date(dateString);

            if(row.leave_start_date && row.leave_end_date){
                const start = new Date(row.leave_start_date);
                const end = new Date(row.leave_end_date);
                if(selected >= start && selected <= end){
                    return false;
                }
            }
            
            //eksluder i vising hvis valgt dato er etter slutt dato (personen har sluttet)
            if(row.end_date){
                const endDate = new Date(row.end_date);
                if(selected >= endDate){
                    return false;
                }
            }
          
            //eksluder i vising hvis valgt dato i dashbord er før startdato (før en ansatt har begynt)
            if(row.start_date){
                const startDate = new Date(row.start_date);
                if(selected < startDate){
                    return false;
                }
            }
            return true;
        })
        .map(row => ({
            employee_id: row.employee_id,
            name: row.employee_name,
            epost: row.epost,
            birthdate: row.birthdate,
            form_of_employeement: row.form_of_employeement,
            employee_percentages: row.employee_percentages,
            employeeNr_Talkmore: row.employeeNr_Talkmore,
            employeeNr_Telenor: row.employeeNr_Telenor,
            workPosistion_title: row.workPosistion_title,
            team_name: row.team_name
        }));
        res.status(200).json(result);

    }catch(err){
        console.error('Feil ved henting av dagsoversikt ansatte',err);
        res.status(500).json({message: 'Noe gikk galt', error:err.message});
    }
})
export default router;