"use strict";(()=>{var e={};e.id=7183,e.ids=[7183],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6005:e=>{e.exports=require("node:crypto")},29559:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>b,patchFetch:()=>v,requestAsyncStorage:()=>h,routeModule:()=>g,serverHooks:()=>y,staticGenerationAsyncStorage:()=>x});var n={};r.r(n),r.d(n,{POST:()=>m});var o=r(49303),a=r(88716),i=r(60670),s=r(91585),l=r(6906),p=r(22576);function d(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var u=r(49374);let c=s.Ry({email:s.Z_().trim().email("Correo inv\xe1lido").max(160),fullName:s.Z_().trim().min(2).max(120),accountType:s.Km(["PERSONAL","BUSINESS"]),defaultCurrency:s.Km(["PEN","USD"]),country:s.Z_().trim().min(2).max(3)}),f=new Map;async function m(e){let t;try{t=await e.json()}catch{return(0,l.qF)({code:"VALIDATION_ERROR",message:"Body JSON inv\xe1lido"})}let r=c.safeParse(t);if(!r.success)return(0,l.QM)(r.error);let n=function(e){let t=e.headers.get("x-forwarded-for");if(t)return t.split(",")[0]?.trim()||"unknown";let r=e.headers.get("x-real-ip");return r?.trim()||"unknown"}(e);if(function(e){let t=Date.now(),r=f.get(e);return!r||t>r.resetAt?(f.set(e,{count:1,resetAt:t+6e5}),!1):r.count>=3||(f.set(e,{count:r.count+1,resetAt:r.resetAt}),!1)}(`${n}:${r.data.email.toLowerCase()}`))return(0,l.N9)({sent:!1,reason:"RATE_LIMITED"});if(!p.m)return(0,l.N9)({sent:!1,reason:"RESEND_NOT_CONFIGURED"});let o=(0,u.iA)(e);try{let{error:e}=await p.m.emails.send({from:p.v,to:r.data.email,subject:"Bienvenido a FinTrack \xb7 Tu acceso est\xe1 casi listo",html:function(e){var t;let r=d(e.fullName||"Usuario"),n=d({PE:"Per\xfa",CO:"Colombia",CL:"Chile",MX:"M\xe9xico",US:"Estados Unidos",ES:"Espa\xf1a"}[t=e.country]??t),o=d(e.defaultCurrency),a="BUSINESS"===e.accountType?"Empresa / equipo":"Personal",i=e.appUrl.replace(/\/+$/,""),s=`${i}/settings?tab=security`,l=d(`${i}/brand/fintrack-mark.png`);return`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a FinTrack</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family: Inter, Segoe UI, Arial, sans-serif; color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px; background:#f1f5f9;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
          <tr>
            <td style="background:linear-gradient(135deg, #054d38 0%, #0a7b58 100%); color:#ffffff; border-radius:16px 16px 0 0; padding:24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px; vertical-align:middle;">
                    <img src="${l}" alt="FinTrack" width="34" height="34" style="width:34px;height:34px;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.85;">FinTrack</p>
                  </td>
                </tr>
              </table>
              <h1 style="margin:10px 0 0; font-size:24px; line-height:1.2;">Bienvenido, ${r}</h1>
              <p style="margin:8px 0 0; font-size:14px; line-height:1.5; opacity:0.94;">
                Tu cuenta fue creada correctamente. Solo falta validar tu correo para activar el acceso completo.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff; border:1px solid #dbe3ea; border-top:0; border-radius:0 0 16px 16px; padding:24px 28px;">
              <p style="margin:0 0 14px; font-size:14px; color:#334155; line-height:1.6;">
                Este registro se configur\xf3 con las siguientes preferencias iniciales:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Tipo de cuenta</td>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; text-align:right;">${a}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Moneda base</td>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; text-align:right;">${o}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; font-size:13px; color:#475569;">Pa\xeds</td>
                  <td style="padding:12px 14px; font-size:13px; font-weight:600; text-align:right;">${n}</td>
                </tr>
              </table>

              <div style="margin-top:18px; padding:14px 16px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
                <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#0f766e; font-weight:700;">
                  Recomendado
                </p>
                <p style="margin:0; font-size:13px; color:#334155; line-height:1.55;">
                  Despu\xe9s de validar tu correo, revisa la secci\xf3n de seguridad para actualizar contrase\xf1a, sesiones activas y alertas.
                </p>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${s}"
                       style="display:inline-block; padding:12px 24px; border-radius:10px; background:#0a7b58; color:#ffffff; font-size:13px; font-weight:700; text-decoration:none;">
                      Revisar seguridad de la cuenta
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:#64748b;">
                Si no reconoces este registro, ignora este correo y contacta soporte.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 6px 0; text-align:center; font-size:11px; color:#94a3b8;">
              \xa9 2026 FinTrack \xb7 Tus finanzas personales bajo control
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`}({fullName:r.data.fullName,accountType:r.data.accountType,defaultCurrency:r.data.defaultCurrency,country:r.data.country,appUrl:o})});if(e)return console.error("[welcome-email] resend error:",e),(0,l.N9)({sent:!1,reason:"SEND_ERROR"});return(0,l.N9)({sent:!0})}catch(e){return console.error("[welcome-email] unexpected error:",e),(0,l.N9)({sent:!1,reason:"UNEXPECTED_ERROR"})}}let g=new o.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/auth/welcome-email/route",pathname:"/api/auth/welcome-email",filename:"route",bundlePath:"app/api/auth/welcome-email/route"},resolvedPagePath:"/Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/app/api/auth/welcome-email/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:h,staticGenerationAsyncStorage:x,serverHooks:y}=g,b="/api/auth/welcome-email/route";function v(){return(0,i.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:x})}},6906:(e,t,r)=>{r.d(t,{Gu:()=>a,N9:()=>o,QM:()=>p,Yv:()=>d,bN:()=>c,l:()=>u,qF:()=>l,y3:()=>i});var n=r(87070);function o(e,t=200){return n.NextResponse.json({ok:!0,data:e},{status:t})}function a(e){return n.NextResponse.json({ok:!0,data:e},{status:201})}function i(){return new n.NextResponse(null,{status:204})}let s={NOT_FOUND:404,UNAUTHORIZED:401,VALIDATION_ERROR:422,BUSINESS_RULE_ERROR:422,DATABASE_ERROR:500,ATOMICITY_FAILURE:500};function l(e){let t=s[e.code]??500;return n.NextResponse.json({ok:!1,error:{code:e.code,message:e.message,detail:e.detail}},{status:t})}function p(e){let t={};for(let r of e.issues){let e=r.path.join(".");t[e]||(t[e]=[]),t[e].push(r.message)}let r=e.issues[0],o=r?.path.join(".")||"dato",a=r?.message?`Campo "${o}": ${r.message}`:void 0;return n.NextResponse.json({ok:!1,error:{code:"VALIDATION_ERROR",message:"Los datos enviados no son v\xe1lidos",detail:a,fields:t}},{status:422})}function d(e="No autorizado"){return n.NextResponse.json({ok:!1,error:{code:"UNAUTHORIZED",message:e}},{status:401})}function u(e,t){return e.ok?o(e.data,t??200):l(e.error)}async function c(e){let{data:{user:t}}=await e.auth.getUser();return t?.id??null}},22576:(e,t,r)=>{r.d(t,{m:()=>a,v:()=>i});var n=r(82591);let o=process.env.RESEND_API_KEY,a=o?new n.R(o):null,i=process.env.RESEND_FROM_EMAIL??"FinTrack <noreply@fintrack.app>"},49374:(e,t,r)=>{function n(e){if(!e)return null;let t=e.trim();return!t||t.startsWith("<")&&t.endsWith(">")?null:t.startsWith("http://")||t.startsWith("https://")?t.replace(/\/+$/,""):`https://${t.replace(/\/+$/,"")}`}function o(e){return n(process.env.NEXT_PUBLIC_SITE_URL)??n("http://localhost:3000")??n(process.env.VERCEL_PROJECT_PRODUCTION_URL)??n(process.env.VERCEL_URL)??new URL(e.url).origin}r.d(t,{iA:()=>o})},79925:e=>{var t=Object.defineProperty,r=Object.getOwnPropertyDescriptor,n=Object.getOwnPropertyNames,o=Object.prototype.hasOwnProperty,a={};function i(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function s(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,o]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=o?o:"true"))}catch{}}return t}function l(e){var t,r;if(!e)return;let[[n,o],...a]=s(e),{domain:i,expires:l,httponly:u,maxage:c,path:f,samesite:m,secure:g,partitioned:h,priority:x}=Object.fromEntries(a.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let r in e)e[r]&&(t[r]=e[r]);return t}({name:n,value:decodeURIComponent(o),domain:i,...l&&{expires:new Date(l)},...u&&{httpOnly:!0},..."string"==typeof c&&{maxAge:Number(c)},path:f,...m&&{sameSite:p.includes(t=(t=m).toLowerCase())?t:void 0},...g&&{secure:!0},...x&&{priority:d.includes(r=(r=x).toLowerCase())?r:void 0},...h&&{partitioned:!0}})}((e,r)=>{for(var n in r)t(e,n,{get:r[n],enumerable:!0})})(a,{RequestCookies:()=>u,ResponseCookies:()=>c,parseCookie:()=>s,parseSetCookie:()=>l,stringifyCookie:()=>i}),e.exports=((e,a,i,s)=>{if(a&&"object"==typeof a||"function"==typeof a)for(let i of n(a))o.call(e,i)||void 0===i||t(e,i,{get:()=>a[i],enumerable:!(s=r(a,i))||s.enumerable});return e})(t({},"__esModule",{value:!0}),a);var p=["strict","lax","none"],d=["low","medium","high"],u=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,r]of s(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>i(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>i(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},c=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;let o=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(let e of Array.isArray(o)?o:function(e){if(!e)return[];var t,r,n,o,a,i=[],s=0;function l(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,a=!1;l();)if(","===(r=e.charAt(s))){for(n=s,s+=1,l(),o=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(a=!0,s=o,i.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!a||s>=e.length)&&i.push(e.substring(t,e.length))}return i}(o)){let t=l(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,o=this._parsed;return o.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=i(r);t.append("set-cookie",e)}}(o,this._headers),this}delete(...e){let[t,r,n]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:r,domain:n,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(i).join("; ")}}},92044:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RequestCookies:function(){return n.RequestCookies},ResponseCookies:function(){return n.ResponseCookies},stringifyCookie:function(){return n.stringifyCookie}});let n=r(79925)}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,5972,1585,2591],()=>r(29559));module.exports=n})();