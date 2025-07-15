import cron from 'node-cron';
import { syncGenesysEmployees } from '../Funksj_stotte/syncGenesysEmployees.js';
console.log('[CRON] syncEmployeesCron.js er lastet inn');

//Denne skal kjøre hver kveld kl 23 og sjekke om det er nye ansatte fra api genesys som er lagt til
//synsGenesysEmployees filen som ligger i funkjs_støtte mappen
//Kjører hvert 2 min for levering av kode og prosjekt
//CRON JOB hver hver uke, mnd , år , kl 23 ('0 23 * * *')
//tester med 5 minutter nå ('*/5 * * * *')
cron.schedule('*/2 * * * *', async () => {
    console.log('[CRON] starter synskronisering av testbrukere fra api genesys');
    try{
        await syncGenesysEmployees();
        console.log('[CRON] Synkronisering fullført');
    }catch{
        console.error('[CRON] Feil under synkroniseringen:', err);
    }
});