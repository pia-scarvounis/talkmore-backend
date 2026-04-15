// rutere for Admin cruds på team
import {Router} from 'express';
import pool from   '../../config/db.js'
//middleware admin
import { authenticateToken, requireAdmin } from '../../AuthenticateUsers/AuthMiddleware.js';

const router = Router();

//Legger til nytt team med department id (hvilken avdeling teamet skal tilhøre)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    const {team_name, department_id } = req.body;

    if(!team_name || !department_id){
        return res.status(400).json({message: 'team_name og department_id er påkrevd'});
    }
    try{
        const [result] = await pool.query(
            `INSERT INTO team (team_name, department_id) VALUES (?, ?)`,
            [team_name, department_id]
        );
        res.status(201).json({team_id: result.insertId, team_name, department_id});

    }catch(err){
        console.error('[POST/ team] Feil', err);
        res.status(500).json({message: 'Feil vd oppretting av team'});
    }
});

//Endrer team i en avdeling
router.put('/:team_id', authenticateToken, requireAdmin, async (req, res) => {
    //henter team id fra url
    const {team_id} = req.params;
    //henter nye team navn og avd id fra body
    const {team_name, department_id} = req.body;

    try{
        //sql 
        const [ result ] = await pool.query(
            `UPDATE team SET team_name = ?, department_id = ? WHERE team_id = ?`,
            [team_name, department_id, team_id]
        );
        //Hvis team navn ikke er funnet
        if(result.affectedRows === 0){
            return res.status(404).json({message: 'Fant ikke team med oppgitt ID'});
        }
        res.status(200).json({message:'Team navn oppdatert'});
    }catch(err){
        console.error('[PUT /team/:team_id] Feil', err);
        res.status(500).json({message:'Feil ved oppdatering av team'});
    }
});

router.delete('/:team_id', authenticateToken, requireAdmin, async (req, res) => {
    //henter id fra url
    const {team_id} = req.params;

    try{
        const [result] = await pool.query(
            `DELETE FROM team WHERE team_id = ?`,
            [team_id]
        );
        if(result.affectedRows === 0){
            return res.status(404).json({message: 'Fant ikke team med oppgitt ID'});
        }
        res.status(200).json({message:'Team slettet'});

    }catch(err){
        console.error('[DELETE/team/team_id] Feil:', err);
        res.status(500).json({message:'Feil ved sletting av team'});
    }

});

export default router;