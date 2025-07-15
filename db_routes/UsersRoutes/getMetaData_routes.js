import {Router} from 'express';
import pool from '../../config/db.js';
import dotenv from 'dotenv';
//middleware
import { authenticateToken, requireTeamLeaderOrAdmin } from '../../AuthenticateUsers/AuthMiddleware.js';

const router = Router();
dotenv.config();

//Hente alle avdelinger
router.get('/departments', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) =>{
    try{
        const [departments] = await pool.query(`
            SELECT * FROM department
        `)
        res.json(departments);
    }catch(err){
        console.error('Feil ved henting av avdelinger', err);
        res.status(500).json({error:'Noe gikk galt'})
    }
})

//Hente alle Team og join med department tabellen
router.get('/teams', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
    try{
        const [teams] = await pool.query(`
        SELECT 
            team.team_id,
            team.team_name,
            team.department_id AS team_department_id,
            department.department_name
        FROM team
        JOIN department ON team.department_id = department.department_id
        `);
        res.json(teams)

    }catch(err){
        console.error('Feil ved henting av team', err);
        res.status(500).json({error: 'noe gikk galt'})
    }
})

//Hente alle stillinger
router.get('/posistions', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) =>{
    try{
        const [posistions] = await pool.query(`
            SELECT * FROM workPosistion
        `);
        res.json(posistions);

    }catch(err){
        console.error('Feil ved henting av stillinger');
        res.status(500).json({error:'Noe gikk galt'})
    }
});

router.get('/licenses', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) =>{
    try{
        const [licenses] = await pool.query(`
            SELECT * FROM license
        `);
        res.json(licenses);
    }catch(err){
        console.err('Feil ved henting av lisenser:', err);
        res.status(500).json({error: 'Noe gikk galt ved henting av lisenser'})
    }
});



export default router;