import { application, json, Router } from "express";
import dotenv from "dotenv";
import pool from "../../config/db.js";
//middleware
import { authenticateToken, requireTeamLeaderOrAdmin } from "../../AuthenticateUsers/AuthMiddleware.js";

// denne ruteren/filen er ikke i bruk nå men kan videreutvikles senere 
//funkjsonen her er at den henter ansatte som er logget inn (random) skulle egentlig vises på dashbord
dotenv.config();

const router = Router();

//GPT uke dato til å sette inn ansatte som er tilgjengelig/ på jobb
const getWeek = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  };
  

//hjelpefunksjoner til random innlogging fra Mandag-Lørdag 
const shouldWorkToday = (employeeId, percentage, date) => {
    //0= søndag, 1= mandag og 6= lørdag
    const weekday = date.getDay();

    if(weekday === 0) return false;

    // Hvor mange dager i uka som kan jobbes, 
    //100% stillinger = fast hver dag man-fre
    //under 100% stillinger, eks 50% = 3 dager random plassert mellom man-fre
    // kilde GPT
    if (percentage === 100) {
        return weekday >= 1 && weekday <= 5; // Mandag–fredag
    }
    
    //Hvis prosentandelen er mindre enn 100%, arbeid på random dager mellom man-lørdag
    const workDaysPerWeek = Math.floor((percentage / 100) * 6); //beregn antall arbeidstid 50% =3 dager

    const week = getWeek(date);
   // Generer "stabile" pseudo-random dager basert på uke og ansatt-ID
    const hash = (employeeId + '-' + week).replace(/\D/g, '').slice(0, 8);
    const seed = parseInt(hash, 10);

    // Lag en liste over dagene 1–6 (man–lør)
    const allDays = [1, 2, 3, 4, 5, 6];


    // Bland dagene "tilfeldig" men konsistent for samme uke og ID
    const shuffled = [...allDays].sort((a, b) => {
    const valA = (seed + a * 31) % 100;
    const valB = (seed + b * 31) % 100;
    return valA - valB;
    });

    const workDays = shuffled.slice(0,  workDaysPerWeek); // Velg f.eks. 3 av 6 dager

    return workDays.includes(weekday);
}

//Simulert pålogging, if true betyr ansatt er tilgjengelig for den datoen
const isLoggedInToday = (employeeId, date) => {
    const hash = (employeeId + date.toISOString()).replace(/\D/g, '').slice(0, 6);
    const rand = parseInt(hash) % 100;
    return rand < 85; // 85% sjanse hvis man skulle jobbet
}

//Denne ruteren henter tilgjengelige ansatte for å vise i de gønne boksene på dashbordet
router.get('/', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
    try{
        //henter valgt dato i request eller ny valgt dato
        const selectedDate = req.query.date ? new Date (req.query.date) : new Date ();
        //Gjør om dato til iso string
        const dateString = selectedDate.toISOString().split('T')[0];

        const [rows] = await pool.query(`
        SELECT 
            e.employee_id,
            e.employee_name,
            e.form_of_employeement,
            e.employee_percentages,
            e.workPosistion_id,
            wp.posistion_title AS workPosistion_title,
            e.team_id,
            t.team_name,
            l.leave_start_date,
            l.leave_end_date
        FROM employee e
        LEFT JOIN workPosistion wp ON e.workPosistion_id = wp.workPosistion_id
        LEFT JOIN team t ON e.team_id = t.team_id
        LEFT JOIN employeeLeave l ON e.employee_id = l.employee_id
    `);

        const result = rows.map(row => {
        const isOnLeave = row.leave_start_date && row.leave_end_date &&
            new Date(dateString) >= new Date(row.leave_start_date) &&
            new Date(dateString) <= new Date(row.leave_end_date);

        const shouldWork = !isOnLeave && shouldWorkToday(row.employee_id, row.employee_percentages, selectedDate);
        const isLoggedIn = shouldWork ? isLoggedInToday(row.employee_id, selectedDate) : false;
        
        
        console.log(`Employee ${row.employee_id} skal jobbe ${shouldWork ? 'idag' : 'ikke idag'}`);

        return /* {
            employee_id: row.employee_id,
            name: row.employee_name,
            form_of_employeement: row.form_of_employeement,
            employee_percentages: row.employee_percentages,
            workPosistion_title: row.workPosistion_title,
            team_name: row.team_name,
            is_on_leave: isOnLeave,
            is_working_today: shouldWork,
            is_logged_in: isLoggedIn
      };*/
      return { /* kommenterte ut koden over, måtte legge til denne istedet, for at kortene på dashboars skal vises riktig: */
        employee_id: row.employee_id,
        employee_name: row.employee_name, // brukes i ProfileCards
        employeeNr_Talkmore: row.employee_id, // midlertidig Talkmore-nummer
        employeeNr_Telenor: null, //  placeholder – kan endres hvis vi har dette i databasen
      form_of_employeement: row.form_of_employeement,
        employee_percentages: row.employee_percentages,
        workPosistion_title: row.workPosistion_title,
        team_name: row.team_name,
      
        is_on_leave: isOnLeave,
        is_working_today: shouldWork,
        is_logged_in: isLoggedIn
      };
      
    });
        res.status(200).json(result);

    }catch(err){
        console.error('Feil ved henting av tlgjengelige ansatte i dashbord ansatte', err);
        res.status(500).json({message: 'Noe gikk galt', error: err.message});
    }
})
export default router;