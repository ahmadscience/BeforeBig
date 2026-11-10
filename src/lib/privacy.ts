export const privacyCookie="beforebig_privacy";
export function analyticsAllowed(choice:string|undefined|null,gpc:string|undefined|null) { return choice==="allow" && gpc!=="1"; }
export function browserAnalyticsAllowed() {
  if(typeof document==="undefined")return false;
  const gpc=(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl;
  const choice=document.cookie.split(";").map(value=>value.trim()).find(value=>value.startsWith(privacyCookie+"="))?.slice(privacyCookie.length+1);
  return analyticsAllowed(choice,gpc?"1":null);
}
