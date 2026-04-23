const c=async(e,s={})=>{const n={...s,credentials:"include"},a=await fetch(e,n);let t;try{t=await a.json()}catch{t={ok:!1,error:"Invalid response format"}}return{response:a,data:t}};export{c as a};
