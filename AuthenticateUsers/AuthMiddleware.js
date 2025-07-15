import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';


dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateToken(req, res, next){
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; //Bearertoken

    if(!token){
        return res.status(401).json({message:'ingen token oppgitt'});
    }

    jwt.verify(token, JWT_SECRET, (err, user)=>{
        if (err) return res.status(403).json({message:'Ugyldig token'});
        req.user = user;
        next();
    })
}

// denne brukes når både admin og teamleder skal ha tilgang i ruteren (get rutere)
export function requireTeamLeaderOrAdmin(req, res, next){
    const allowedRoles = ['Teamleder', 'Admin'];
    if(!allowedRoles.includes(req.user.role)){
        return res.status(403).json({message:'Tilgang kun for Teamledere og Admin'});
    }
    //Hvis riktig gå videre
    next();
}

//Denne brukes når kun Admin kan ha tilgang (opprette, endre og slette rutere)
export function requireAdmin(req, res, next){
    if(req.user.role !== 'Admin'){
        return res.status(403).json({message: 'kun for Admin'});
    }
    //hvis Admin gå videre
    next();
}
