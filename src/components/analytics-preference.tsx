"use client";
import { useState } from "react";
export function AnalyticsPreference({choice,gpc}:{choice:string;gpc:boolean}) {
  const [pending,setPending]=useState(false);const [error,setError]=useState("");
  async function save(value:string){
    setPending(true);setError("");
    try{const response=await fetch("/api/privacy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({choice:value})});if(!response.ok)throw Error();
      if(value==="deny")try{sessionStorage.removeItem("beforebig.analytics.session");}catch{/* Storage restrictions must not prevent opt-out from taking effect. */}
      // A full reload unloads an already-running analytics tag, including after client navigation.
      window.location.reload();
    }catch{setError("Preference could not be saved. Try again.");setPending(false);}
  }
  return <div><p className="privacy-status">Optional analytics: <strong>{gpc?"off — browser privacy signal":choice==="allow"?"on":"off"}</strong></p>
    <p className="muted">Off by default. This choice applies to this browser for one year. Essential sign-in, security, and theme storage still work. Your browser privacy signal takes priority.</p>
    <div className="community-row"><button className="button button-ghost" disabled={pending} onClick={()=>save("deny")}>Keep analytics off</button><button className="button button-ghost" disabled={pending||gpc} onClick={()=>save("allow")}>Allow optional analytics</button></div>
    {error?<p role="alert" className="form-error">{error}</p>:null}
  </div>;
}
