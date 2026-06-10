"use strict";(()=>{var e={};e.id=6533,e.ids=[6533],e.modules={72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6005:e=>{e.exports=require("node:crypto")},66603:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>x,patchFetch:()=>h,requestAsyncStorage:()=>g,routeModule:()=>u,serverHooks:()=>m,staticGenerationAsyncStorage:()=>f});var a={};r.r(a),r.d(a,{POST:()=>d});var o=r(49303),n=r(88716),s=r(60670),i=r(15717),l=r(6906),p=r(93304),c=r(49374);async function d(e){let t=(0,i.eI)(),{data:{user:r},error:a}=await t.auth.getUser();if(a||!r||!r.email)return(0,l.Yv)();let o=(0,c.iA)(e),n=`${o}/auth/callback?next=${encodeURIComponent("/settings?tab=security")}`,s=await (0,p.i)({email:r.email,appUrl:o,redirectTo:n});if(s.sent)return(0,l.N9)({message:"Correo enviado correctamente",email:r.email});console.warn("[profile/send-reset-email] custom email fallback:",s.reason);let{error:d}=await t.auth.resetPasswordForEmail(r.email,{redirectTo:n});return d?(0,l.qF)({code:"AUTH_ERROR",message:d.message??"No se pudo enviar el correo de restablecimiento"}):(0,l.N9)({message:"Correo enviado correctamente",email:r.email})}let u=new o.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/profile/send-reset-email/route",pathname:"/api/profile/send-reset-email",filename:"route",bundlePath:"app/api/profile/send-reset-email/route"},resolvedPagePath:"/Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/app/api/profile/send-reset-email/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:g,staticGenerationAsyncStorage:f,serverHooks:m}=u,x="/api/profile/send-reset-email/route";function h(){return(0,s.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:f})}},6906:(e,t,r)=>{r.d(t,{Gu:()=>n,N9:()=>o,QM:()=>p,Yv:()=>c,bN:()=>u,l:()=>d,qF:()=>l,y3:()=>s});var a=r(87070);function o(e,t=200){return a.NextResponse.json({ok:!0,data:e},{status:t})}function n(e){return a.NextResponse.json({ok:!0,data:e},{status:201})}function s(){return new a.NextResponse(null,{status:204})}let i={NOT_FOUND:404,UNAUTHORIZED:401,VALIDATION_ERROR:422,BUSINESS_RULE_ERROR:422,DATABASE_ERROR:500,ATOMICITY_FAILURE:500};function l(e){let t=i[e.code]??500;return a.NextResponse.json({ok:!1,error:{code:e.code,message:e.message,detail:e.detail}},{status:t})}function p(e){let t={};for(let r of e.issues){let e=r.path.join(".");t[e]||(t[e]=[]),t[e].push(r.message)}let r=e.issues[0],o=r?.path.join(".")||"dato",n=r?.message?`Campo "${o}": ${r.message}`:void 0;return a.NextResponse.json({ok:!1,error:{code:"VALIDATION_ERROR",message:"Los datos enviados no son v\xe1lidos",detail:n,fields:t}},{status:422})}function c(e="No autorizado"){return a.NextResponse.json({ok:!1,error:{code:"UNAUTHORIZED",message:e}},{status:401})}function d(e,t){return e.ok?o(e.data,t??200):l(e.error)}async function u(e){let{data:{user:t}}=await e.auth.getUser();return t?.id??null}},22576:(e,t,r)=>{r.d(t,{m:()=>n,v:()=>s});var a=r(82591);let o=process.env.RESEND_API_KEY,n=o?new a.R(o):null,s=process.env.RESEND_FROM_EMAIL??"FinTrack <noreply@fintrack.app>"},93304:(e,t,r)=>{r.d(t,{i:()=>s});var a=r(22576),o=r(15717);function n(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}async function s(e){if(!a.m)return{sent:!1,reason:"RESEND_NOT_CONFIGURED"};if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return{sent:!1,reason:"SERVICE_ROLE_NOT_CONFIGURED"};try{let t=(0,o.mq)(),{data:r,error:s}=await t.auth.admin.generateLink({type:"recovery",email:e.email,options:{redirectTo:e.redirectTo}}),i=r?.properties?.action_link;if(s||!i)return console.error("[password-reset-email] generate link error:",s),{sent:!1,reason:"GENERATE_LINK_FAILED"};let{error:l}=await a.m.emails.send({from:a.v,to:e.email,subject:"Restablece tu contrasena de FinTrack",html:function(e){let t=n(e.resetUrl),r=n(`${e.appUrl.replace(/\/+$/,"")}/brand/fintrack-mark.png`),a=Number.isFinite(e.expiresInMinutes)?Math.max(1,Math.floor(e.expiresInMinutes)):60;return`<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Restablecer tu contrasena - FinTrack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-text-size-adjust: 100%; }
    a { color: inherit; text-decoration: none; }
    img { border: 0; display: block; }
  </style>
</head>
<body style="background-color:#f8fafc; margin:0; padding:0;">

  <div style="display:none;max-height:0;overflow:hidden;color:#f8fafc;font-size:1px;">
    Solicitaste restablecer tu contrasena de FinTrack. El enlace expira pronto.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc; padding:34px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

          <tr>
            <td style="background-color:#075941; border-radius:18px 18px 0 0; padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px; vertical-align:middle;">
                    <img src="${r}" alt="FinTrack" width="34" height="34" style="width:34px;height:34px;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">FinTrack</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff; border:1px solid #e2e8f0; border-top:0; border-radius:0 0 18px 18px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:30px 30px 0;">
                <tr>
                  <td>
                    <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.09em; color:#0f766e; margin-bottom:10px;">Seguridad de cuenta</p>
                    <h1 style="font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-0.02em; line-height:1.2; margin-bottom:10px;">
                      Restablecer contrasena
                    </h1>
                    <p style="font-size:14px; color:#475569; line-height:1.6;">
                      Recibimos una solicitud para cambiar tu contrasena. Si fuiste tu, usa el boton de abajo para continuar.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:22px 30px 0;">
                <tr>
                  <td style="border:1px solid #dbe7f1; border-radius:12px; background:#f8fbff; padding:14px 16px;">
                    <p style="font-size:12px; font-weight:700; color:#075985; margin-bottom:4px;">Enlace seguro de un solo uso</p>
                    <p style="font-size:12px; color:#64748b; line-height:1.55;">
                      Este enlace expira en <strong style="color:#0f766e;">${a} minutos</strong> y se invalida despues de usarse.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:26px 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${t}"
                       style="display:inline-block;padding:14px 32px;background-color:#059669;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;border-radius:12px;box-shadow:0 6px 20px rgba(5,150,105,0.28);">
                      Restablecer mi contrasena ->
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 30px 0;">
                <tr>
                  <td style="border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; padding:14px 16px;">
                    <p style="font-size:12px; color:#64748b; margin-bottom:8px; line-height:1.5;">
                      Si el boton no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="font-size:11px; color:#0f766e; word-break:break-all; line-height:1.55; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                      ${t}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 30px 0;">
                <tr>
                  <td style="border:1px solid #fecaca; border-radius:12px; background:#fef2f2; padding:14px 16px;">
                    <p style="font-size:12px; font-weight:700; color:#b91c1c; margin-bottom:4px;">No solicitaste este cambio?</p>
                    <p style="font-size:12px; color:#7f1d1d; line-height:1.55;">
                      Ignora este correo. Tu contrasena actual seguira activa. Si detectas actividad sospechosa, cambia tu clave y revisa sesiones activas.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 30px 28px;">
                <tr>
                  <td style="border-top:1px solid #eef2f7; padding-top:16px; text-align:center;">
                    <p style="font-size:11px; color:#94a3b8; margin-bottom:4px;">&copy; 2026 FinTrack \xb7 Tus finanzas personales bajo control</p>
                    <p style="font-size:10px; color:#a8b4c2;">Este es un correo automatico. No respondas este mensaje.</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`}({appUrl:e.appUrl,resetUrl:i,expiresInMinutes:60})});if(l)return console.error("[password-reset-email] resend error:",l),{sent:!1,reason:"SEND_FAILED"};return{sent:!0}}catch(e){return console.error("[password-reset-email] unexpected error:",e),{sent:!1,reason:"UNEXPECTED_ERROR"}}}},49374:(e,t,r)=>{function a(e){if(!e)return null;let t=e.trim();return!t||t.startsWith("<")&&t.endsWith(">")?null:t.startsWith("http://")||t.startsWith("https://")?t.replace(/\/+$/,""):`https://${t.replace(/\/+$/,"")}`}function o(e){return a(process.env.NEXT_PUBLIC_SITE_URL)??a("http://localhost:3000")??a(process.env.VERCEL_PROJECT_PRODUCTION_URL)??a(process.env.VERCEL_URL)??new URL(e.url).origin}r.d(t,{iA:()=>o})},15717:(e,t,r)=>{r.d(t,{eI:()=>n,mq:()=>s});var a=r(72728),o=r(71615);function n(){let e=(0,o.cookies)();return(0,a.createServerClient)("https://yahocagtrxvevqhhlkln.supabase.co","sb_publishable_nxnr2DPKy2_DxjHQAn2Gyg_l81Qaspk",{cookies:{get:t=>e.get(t)?.value,set(t,r,a){try{e.set({name:t,value:r,...a})}catch{}},remove(t,r){try{e.set({name:t,value:"",...r})}catch{}}}})}function s(){return(0,a.createServerClient)("https://yahocagtrxvevqhhlkln.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY,{cookies:{get:()=>void 0,set:()=>{},remove:()=>{}},auth:{persistSession:!1,autoRefreshToken:!1}})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,3637,5972,2591],()=>r(66603));module.exports=a})();