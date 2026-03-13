export default async function handler(req, res) {

 const response = await fetch("API_RESULTADOS");
 const data = await response.json();

 const TOKEN = process.env.BOT_TOKEN
 const CHAT_ID = process.env.CHAT_ID

 if(data.goal){

   await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({
       chat_id: CHAT_ID,
       text:`⚽ GOL\n${data.team}\n${data.minute}'`
     })
   })

 }

 res.status(200).json({ok:true})
}
