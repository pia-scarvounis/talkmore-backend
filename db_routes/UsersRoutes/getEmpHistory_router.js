import { Router } from "express";
import dotenv from "dotenv";
import pool from "../../config/db.js";
//middleware
import { authenticateToken, requireTeamLeaderOrAdmin } from "../../AuthenticateUsers/AuthMiddleware.js";

dotenv.config();

const router = Router();

//hente historikken til den valgte ansatte med id til ansatte
router.get('/:id', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) =>{
    const {id} = req.params;

    try{
        //Henter bruker sin historikk med admin navn og id som har endret sortert etter siste endring
        const [history] =await pool.query(`
            SELECT 
                cl.changeLog_id,
                cl.employee_id,
                cl.admin_id,
                cl.field_changed,
                cl.old_value,
                cl.new_value,
                cl.change_date,
                u.username AS endret_av,
                e.employee_name AS endret_av_navn
            FROM changeLog cl
            JOIN userOfTool u ON cl.admin_id = u.user_id
            JOIN employee e ON u.employee_id = e.employee_id
            WHERE cl.employee_id = ?
            ORDER BY cl.change_date DESC
        `,[id]);

        res.status(200).json(history);

    }catch(err){
        console.error('Feil ved henting av historikk:',err);
        res.status(500).json({error: 'kunne ikke hente historikk'});
    }
    /**SELECT
                cl.changeLog_id,
                cl.employee_id,
                cl.admin_id,
                cl.employeeNr_Talkmore,
                cl.employeeNr_Telenor,
                cl.department_id,
                d.department_name,
                cl.team_id,
                t.team_name,
                cl.workPosistion_id,
                wp.posistion_title AS workPosistion_title,
                cl.form_of_employeement,
                cl.employee_percentages,
                cl.start_date,
                cl.end_date,
                cl.leave_id,
                cl.leave_percentage,
                cl.leave_start_date,
                cl.leave_end_date,
                cl.change_date,
                u.username AS endret_av,
                e.employee_name AS endret_av_navn
            FROM changeLog cl
            JOIN userOfTool u ON cl.admin_id = u.user_id
            JOIN employee e ON u.employee_id = e.employee_id
            LEFT JOIN department d ON cl.department_id = d.department_id
            LEFT JOIN team t ON cl.team_id = t.team_id
            LEFT JOIN workPosistion wp ON cl.workPosistion_id = wp.workPosistion_id
            WHERE cl.employee_id = ?
            ORDER BY cl.change_date DESC */
})

export default router;