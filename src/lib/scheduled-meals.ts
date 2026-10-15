export const scheduledMealLabels:Record<string,string>={requested:'À confirmer',confirmed:'Confirmé',preparing:'En préparation',ready:'Prêt',completed:'Terminé',cancelled:'Annulé',incident:'Incident à examiner'};
export function nextScheduledStatus(status:string){return ({requested:'confirmed',confirmed:'preparing',preparing:'ready',ready:'completed'} as Record<string,string>)[status]??null;}
