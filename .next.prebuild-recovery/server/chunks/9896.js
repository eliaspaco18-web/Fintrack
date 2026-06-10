exports.id=9896,exports.ids=[9896],exports.modules={57177:(e,t,a)=>{let n={"0b5e38c42b12e95d23213f3b3913ce7d6f09fe16":()=>Promise.resolve().then(a.bind(a,29983)).then(e=>e.deleteTransactionAction),"36a3d2901025964fa5525bd35b46cef5b61d199e":()=>Promise.resolve().then(a.bind(a,29983)).then(e=>e.updateTransactionAction),"6b703e08827fbbce36cc78d17e626c0b091b048c":()=>Promise.resolve().then(a.bind(a,29983)).then(e=>e.createTransactionAction)};async function r(e,...t){return(await n[e]()).apply(null,t)}e.exports={"0b5e38c42b12e95d23213f3b3913ce7d6f09fe16":r.bind(null,"0b5e38c42b12e95d23213f3b3913ce7d6f09fe16"),"36a3d2901025964fa5525bd35b46cef5b61d199e":r.bind(null,"36a3d2901025964fa5525bd35b46cef5b61d199e"),"6b703e08827fbbce36cc78d17e626c0b091b048c":r.bind(null,"6b703e08827fbbce36cc78d17e626c0b091b048c")}},23026:(e,t,a)=>{"use strict";a.d(t,{$8:()=>r,ID:()=>o,IR:()=>i}),a(15424);var n=a(46242),r=(0,n.$)("0b5e38c42b12e95d23213f3b3913ce7d6f09fe16"),o=(0,n.$)("6b703e08827fbbce36cc78d17e626c0b091b048c"),i=(0,n.$)("36a3d2901025964fa5525bd35b46cef5b61d199e")},29983:(e,t,a)=>{"use strict";a.r(t),a.d(t,{createTransactionAction:()=>O,deleteTransactionAction:()=>F,updateTransactionAction:()=>L});var n=a(27745);a(26461);var r=a(30207),o=a(10838),i=a(74942),s=a(85846),d=a(21023);let c=s.Km(["PEN","USD"]),l=s.Z_().regex(/^\d{4}-\d{2}-\d{2}$/,"Formato de fecha inv\xe1lido (YYYY-MM-DD)"),p=s.Z_().uuid("UUID inv\xe1lido"),u=s.Rx({invalid_type_error:"El monto debe ser un n\xfamero"}).positive("El monto debe ser mayor a cero").refine(e=>Math.round(100*e)===100*e,"M\xe1ximo 2 decimales").refine(e=>e<=1e8,"Monto excede el l\xedmite permitido"),m=s.Ry({name:s.Z_().trim().min(1).max(150),asset_type:s.Km(["REAL_ESTATE","VEHICLE","EQUIPMENT","INVESTMENT","OTHER"]),asset_type_id:p.optional(),purchase_value:u.optional(),current_value:u.optional(),purchase_date:l.optional(),depreciation_rate:s.Rx().min(0).max(1).optional(),serial_number:s.Z_().max(100).optional(),location:s.Z_().max(200).optional(),notes:s.Z_().max(500).optional()}),g=s.Ry({credit_type:s.Km(["CREDIT_CARD","LINE_OF_CREDIT"]),name:s.Z_().trim().min(1).max(100),credit_limit:u,interest_rate:s.Rx().min(0).max(999.9999),closing_day:s.Rx().int().min(1).max(31).optional(),payment_day:s.Rx().int().min(1).max(31).optional(),notes:s.Z_().max(500).optional()}),b=s.Ry({creditor_name:s.Z_().trim().min(1).max(150),principal_amount:u.optional(),interest_rate:s.Rx().min(0).max(999.9999),total_installments:s.Rx().int().min(1).max(600),start_date:l.optional(),end_date:l,notes:s.Z_().max(500).optional(),generate_schedule:s.O7().default(!1)}),f=s.Ry({debtor_id:p.optional(),debtor_name:s.Z_().trim().min(1).max(150),due_date:l.optional(),concept:s.Z_().max(300).optional(),notes:s.Z_().max(500).optional()}),_=s.Ry({creditor_id:p.optional(),creditor_name:s.Z_().trim().min(1).max(150),due_date:l.optional(),concept:s.Z_().max(300).optional(),notes:s.Z_().max(500).optional()}),y=s.Ry({source_account_id:p,amount:u,currency:c,payment_method:s.Km(["DEBIT","CREDIT"]).optional(),credit_card_id:p.optional(),credit_operation:s.Km(["CONSUMPTION","PAYMENT"]).optional(),exchange_rate:s.Rx().positive().optional(),description:s.Z_().trim().max(255).optional(),transaction_date:l,category_id:p.optional(),notes:s.Z_().max(1e3).optional(),is_recurring:s.O7().default(!1),recurring_name:s.Z_().trim().min(1,"El nombre de la recurrente es obligatorio").max(150).optional()}),h=y.extend({type:s.i0("INCOME"),payable:_.optional(),sender:s.Z_().max(150).trim().optional()}),x=y.extend({type:s.i0("EXPENSE"),asset:m.optional(),credit:g.optional(),loan:b.optional(),receivable:f.optional(),budget_id:p.optional(),recipient:s.Z_().max(150).trim().optional()}),E=y.extend({type:s.i0("TRANSFER"),destination_account_id:p}),v=s.VK("type",[h,x,E]).superRefine((e,t)=>{"INCOME"!==e.type&&"EXPENSE"!==e.type||e.description&&0!==e.description.trim().length||t.addIssue({code:d.NL.custom,path:["description"],message:"La descripci\xf3n es obligatoria"}),e.is_recurring&&(!e.recurring_name||0===e.recurring_name.trim().length)&&t.addIssue({code:d.NL.custom,path:["recurring_name"],message:"Debes indicar un nombre para guardar la recurrente"}),"EXPENSE"===e.type&&e.asset&&e.credit&&t.addIssue({code:d.NL.custom,path:["asset"],message:"Una transacci\xf3n no puede generar activo y cr\xe9dito simult\xe1neamente"}),"EXPENSE"!==e.type||"CREDIT"!==e.payment_method||e.credit_card_id||t.addIssue({code:d.NL.custom,path:["credit_card_id"],message:"Selecciona una tarjeta de cr\xe9dito para este egreso"}),"EXPENSE"!==e.type||"PAYMENT"!==e.credit_operation||e.credit_card_id||t.addIssue({code:d.NL.custom,path:["credit_card_id"],message:"Selecciona la tarjeta para registrar su pago"}),"TRANSFER"===e.type&&e.source_account_id===e.destination_account_id&&t.addIssue({code:d.NL.custom,path:["destination_account_id"],message:"La cuenta origen y destino no pueden ser la misma"})}),R=s.Ry({description:s.Z_().trim().min(1).max(255).optional(),category_id:p.nullable().optional(),notes:s.Z_().max(1e3).nullable().optional(),is_recurring:s.O7().optional(),transaction_date:l.optional()}).refine(e=>Object.values(e).some(e=>void 0!==e),{message:"Debe incluir al menos un campo para actualizar"});s.Ry({type:s.Km(["INCOME","EXPENSE","TRANSFER"]).optional(),account_id:p.optional(),category_id:p.optional(),currency:c.optional(),date_from:l.optional(),date_to:l.optional(),search:s.Z_().max(100).optional(),sort_by:s.Km(["transaction_date","amount","created_at"]).optional(),sort_dir:s.Km(["asc","desc"]).optional(),page:s.oQ.number().int().min(1).default(1),per_page:s.oQ.number().int().min(1).max(100).default(20)}).refine(e=>!e.date_from||!e.date_to||e.date_from<=e.date_to,{message:"date_from debe ser anterior o igual a date_to",path:["date_from"]});var N=a(44067),$=a(60727);let I=process.env.RESEND_API_KEY,T=I?new $.R(I):null,w=process.env.RESEND_FROM_EMAIL??"FinTrack <noreply@fintrack.app>";function P(e){if(!e)return null;let t=e.trim();return!t||t.startsWith("<")&&t.endsWith(">")?null:t.startsWith("http://")||t.startsWith("https://")?t.replace(/\/+$/,""):`https://${t.replace(/\/+$/,"")}`}function A(e,t){return new Intl.NumberFormat("es-PE",{style:"currency",currency:t,minimumFractionDigits:2}).format(e)}let D={INCOME:{label:"ingreso",labelCap:"Ingreso",verb:"recibiste un ingreso",sign:"+",accentBg:"#065f46",accentLine:"#10b981",amountColor:"#065f46",sectionColor:"#065f46",chipBg:"#d1fae5",chipText:"#064e3b",btnBg:"#059669",btnShadow:"rgba(5,150,105,0.35)"},EXPENSE:{label:"gasto",labelCap:"Gasto",verb:"realizaste un gasto",sign:"-",accentBg:"#7f1d1d",accentLine:"#ef4444",amountColor:"#991b1b",sectionColor:"#991b1b",chipBg:"#fee2e2",chipText:"#7f1d1d",btnBg:"#dc2626",btnShadow:"rgba(220,38,38,0.35)"},TRANSFER:{label:"transferencia",labelCap:"Transferencia",verb:"realizaste una transferencia",sign:"",accentBg:"#1e3a8a",accentLine:"#3b82f6",amountColor:"#1d4ed8",sectionColor:"#1d4ed8",chipBg:"#dbeafe",chipText:"#1e3a8a",btnBg:"#2563eb",btnShadow:"rgba(37,99,235,0.35)"}};function C(e,t,a=!1){return`
  <tr>
    <td style="
      padding: 13px 24px;
      border-bottom: ${a?"none":"1px solid #f1f5f9"};
    ">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:13px; color:#64748b;">${e}</td>
          <td style="font-size:13px; color:#111827; font-weight:600; text-align:right;">${t}</td>
        </tr>
      </table>
    </td>
  </tr>`}async function S(e){if(!T)return console.warn("[sendTransactionEmail] RESEND_API_KEY not set — skipping email"),{sent:!1,reason:"RESEND_API_KEY not configured"};let t=(0,o.mq)(),{data:a,error:n}=await t.from("profiles").select("email, full_name, notification_prefs").eq("id",e.userId).single();if(n||!a)return console.error("[sendTransactionEmail] profile error:",n?.message),{sent:!1,reason:"profile_not_found"};if(!(a.notification_prefs??{}).newTransaction)return{sent:!1,reason:"user_preference_disabled"};let r=[e.sourceAccountId,e.destinationAccountId].filter(Boolean),[i,s]=await Promise.all([t.from("accounts").select("id, name").in("id",r),e.categoryId?t.from("categories").select("name").eq("id",e.categoryId).single():Promise.resolve({data:null})]),d=new Map((i.data??[]).map(e=>[e.id,e.name])),c=P(process.env.NEXT_PUBLIC_SITE_URL)??P("http://localhost:3000")??P(process.env.VERCEL_PROJECT_PRODUCTION_URL)??P(process.env.VERCEL_URL)??"http://localhost:3000",l={userName:a.full_name??a.email.split("@")[0]??"",userEmail:a.email,transactionId:e.transactionId,type:e.type,amount:e.amount,currency:e.currency,exchangeRate:e.exchangeRate,description:e.description,transactionDate:e.transactionDate,accountName:d.get(e.sourceAccountId)??"Cuenta",destinationAccountName:e.destinationAccountId?d.get(e.destinationAccountId)??void 0:void 0,categoryName:s.data?.name??void 0,notes:e.notes??void 0,appUrl:c};try{let{error:e}=await T.emails.send({from:w,to:a.email,subject:function(e){let t=D[e.type],a=A(e.amount,e.currency);return`${t.labelCap} registrado: ${t.sign}${a} — ${e.description}`}(l),html:function(e){let t=D[e.type],a=function(e){let t=e.replace(/-/g,""),a=e=>parseInt(e,16).toString(36).toUpperCase().padStart(3,"0").slice(-3),n=a(t.slice(0,4)),r=a(t.slice(8,12)),o=a(t.slice(16,20)),i=a(t.slice(24,28));return`FT-${n}${r}-${o}${i}`}(e.transactionId),n=A(e.amount,e.currency),r=new Date(e.transactionDate+"T12:00:00").toLocaleDateString("es-PE",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),o=e.userName||e.userEmail.split("@")[0]||"Usuario",i=e.appUrl.replace(/\/+$/,""),s=`${i}/transactions?highlight=${e.transactionId}`,d=`${i}/brand/fintrack-mark.png`,c="TRANSFER"===e.type&&e.destinationAccountName?`de <strong>${e.accountName}</strong> hacia <strong>${e.destinationAccountName}</strong>`:`en <strong>${e.accountName}</strong>`,l="INCOME"===e.type?`Recibiste un ingreso de <strong style="color:${t.amountColor};">${n}</strong> en <strong>${e.accountName}</strong>.`:"EXPENSE"===e.type?`Realizaste un gasto de <strong style="color:${t.amountColor};">${n}</strong> en <strong>${e.accountName}</strong>.`:`Realizaste una transferencia de <strong style="color:${t.amountColor};">${n}</strong> ${c}.`,p="USD"===e.currency&&e.exchangeRate?C("Equivalente en soles",`≈ ${A(e.amount*e.exchangeRate,"PEN")} (T/C ${e.exchangeRate.toFixed(3)})`):"",u=e.categoryName?C("Categor\xeda",e.categoryName):"",m=e.notes?C("Notas",e.notes):"",g="TRANSFER"===e.type&&e.destinationAccountName?C("Cuenta destino",e.destinationAccountName):"";return`<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${t.labelCap} registrado — FinTrack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *  { box-sizing:border-box; margin:0; padding:0; }
    body { background-color:#f8fafc; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    a  { text-decoration:none; }
  </style>
</head>
<body style="background-color:#f8fafc; margin:0; padding:0;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f8fafc;font-size:1px;">
    ${t.sign}${n} \xb7 ${e.description} \xb7 ${r}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;">

          <!-- ── LOGO HEADER BAR ── -->
          <tr>
            <td style="
              background-color:${t.accentBg};
              border-radius:16px 16px 0 0;
              padding:20px 28px;
            ">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px; vertical-align:middle;">
                    <img src="${d}" alt="FinTrack" width="36" height="36"
                      style="width:36px;height:36px;border-radius:10px;display:block;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">FinTrack</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CARD ── -->
          <tr>
            <td style="background-color:#ffffff; border-radius:0 0 16px 16px; border:1px solid #e2e8f0; border-top:none; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.07);">

              <!-- Greeting + opening sentence -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 28px 0;">
                <tr>
                  <td>
                    <p style="font-size:15px;color:#374151;margin-bottom:10px;">Hola <strong>${o}</strong>,</p>
                    <p style="font-size:16px;color:#111827;line-height:1.55;margin-bottom:6px;">
                      ${l}
                    </p>
                    <p style="font-size:13px;color:#64748b;line-height:1.5;">
                      Por tu seguridad, te enviamos los datos de tu operaci\xf3n.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 28px 0;">
                <tr><td style="height:1px; background-color:#f1f5f9;"></td></tr>
              </table>

              <!-- ── Monto section ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 28px 0;">
                <tr>
                  <td>
                    <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${t.sectionColor};margin-bottom:10px;">Monto</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                      style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
                      <tbody>
                        <tr>
                          <td style="padding:14px 24px; border-bottom: ${p?"1px solid #f1f5f9":"none"};">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td style="font-size:13px;color:#64748b;">Total del ${t.label}</td>
                                <td style="font-size:15px;color:${t.amountColor};font-weight:800;text-align:right;">${t.sign}${n}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        ${p?`<tr><td style="padding:14px 24px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="font-size:13px;color:#64748b;">Equivalente en soles</td>
                              <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;">≈ ${A(e.amount*(e.exchangeRate??1),"PEN")} (T/C ${(e.exchangeRate??1).toFixed(3)})</td>
                            </tr>
                          </table>
                        </td></tr>`:""}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ── Datos de la operaci\xf3n section ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 28px 0;">
                <tr>
                  <td>
                    <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${t.sectionColor};margin-bottom:10px;">Datos de la operaci\xf3n</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                      style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
                      <tbody>
                        ${C("Tipo de operaci\xf3n",t.labelCap)}
                        ${C("Descripci\xf3n",e.description)}
                        ${C("Fecha",r)}
                        ${C("Cuenta",e.accountName)}
                        ${g}
                        ${u}
                        ${m}
                        ${C("Moneda",e.currency)}
                        ${C("N\xb0 de operaci\xf3n",`<span style="font-family:monospace;letter-spacing:0.06em;">${a}</span>`,!0)}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ── CTA button ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 28px;">
                <tr>
                  <td align="center">
                    <a href="${s}"
                       style="display:inline-block;padding:13px 30px;background-color:${t.btnBg};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.02em;border-radius:10px;box-shadow:0 4px 16px ${t.btnShadow};">
                      Ver movimiento en FinTrack →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:22px 0; text-align:center;">
              <p style="font-size:11px;color:#94a3b8;margin-bottom:4px;">
                \xa9 2026 FinTrack \xb7 Tus finanzas personales bajo control
              </p>
              <p style="font-size:11px;color:#cbd5e1;">
                Ref: <span style="font-family:monospace;">${a}</span> \xb7 Recibes este correo porque tienes activas las alertas de transacciones.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`}(l)});if(e)return console.error("[sendTransactionEmail] resend error:",e),{sent:!1,reason:e.message};return console.info(`[sendTransactionEmail] ✅ sent to ${a.email} \xb7 op ${l.transactionId}`),{sent:!0}}catch(e){return console.error("[sendTransactionEmail] unexpected error:",e),{sent:!1,reason:"unexpected_error"}}}async function k(){let e=(0,o.eI)(),{data:{user:t},error:a}=await e.auth.getUser();return a||!t?{service:null,userId:null,supabase:e}:{service:new i.TransactionService(e),userId:t.id,supabase:e}}async function O(e){let{service:t,userId:a,supabase:n}=await k();if(!t||!a)return N.D.unauthorized();let o=v.safeParse(e);if(!o.success)return N.D.validation("Datos de transacci\xf3n inv\xe1lidos",o.error.issues.map(e=>`${e.path.join(".")}: ${e.message}`).join(" | "));let i=await t.createTransaction(a,o.data);if(i.ok){if(o.data.is_recurring&&o.data.recurring_name?.trim()){let e="EXPENSE"===o.data.type&&o.data.receivable?"RECEIVABLE_LENDING":"INCOME"===o.data.type&&o.data.payable?"PAYABLE_PAYMENT":null,t={user_id:a,name:o.data.recurring_name.trim(),type:o.data.type,sub_type:e,source_account_id:o.data.source_account_id,destination_account_id:"TRANSFER"===o.data.type?o.data.destination_account_id:null,category_id:o.data.category_id??null,budget_id:"EXPENSE"===o.data.type?o.data.budget_id??null:null,debtor_id:"EXPENSE"===o.data.type?o.data.receivable?.debtor_id??null:null,creditor_id:"INCOME"===o.data.type?o.data.payable?.creditor_id??null:null,amount:Number(o.data.amount),currency:o.data.currency,description:i.data.transaction.description?.trim()||null,payment_method:"EXPENSE"===o.data.type?o.data.payment_method??null:null,recipient:"recipient"in o.data&&o.data.recipient?.trim()||null,sender:"sender"in o.data&&o.data.sender?.trim()||null,notes:o.data.notes?.trim()||null,is_active:!0},{data:s,error:d}=await n.from("recurring_transactions").insert(t).select("id, name").single();d?i.data.recurring_template={created:!1,warning:d.message,name:t.name}:(i.data.recurring_template={created:!0,id:s.id,name:s.name},(0,r.revalidatePath)("/recurring"))}(0,r.revalidatePath)("/dashboard"),(0,r.revalidatePath)("/transactions"),(0,r.revalidatePath)("/budgets"),i.data.asset&&(0,r.revalidatePath)("/assets"),i.data.credit&&(0,r.revalidatePath)("/credits"),i.data.loan&&(0,r.revalidatePath)("/credits"),i.data.receivable&&(0,r.revalidatePath)("/receivables"),i.data.payable&&(0,r.revalidatePath)("/payables");let e=i.data.transaction;S({userId:a,transactionId:e.id,type:e.type,amount:Number(e.amount),currency:e.currency,exchangeRate:1!==Number(e.exchange_rate)?Number(e.exchange_rate):void 0,description:e.description,transactionDate:e.transaction_date,sourceAccountId:e.source_account_id,destinationAccountId:e.destination_account_id??null,categoryId:e.category_id??null,notes:e.notes??null}).catch(e=>console.error("[createTransactionAction] email error:",e))}return i}async function L(e,t){let{service:a,userId:n}=await k();if(!a||!n)return N.D.unauthorized();let o=R.safeParse(t);if(!o.success)return N.D.validation("Datos de actualizaci\xf3n inv\xe1lidos",o.error.issues.map(e=>e.message).join(" | "));let i=await a.updateTransaction(n,{id:e,...o.data});return i.ok&&((0,r.revalidatePath)("/dashboard"),(0,r.revalidatePath)("/transactions"),(0,r.revalidatePath)(`/transactions/${e}`)),i}async function F(e,t=!1){let{service:a,userId:n}=await k();if(!a||!n)return N.D.unauthorized();let o=await a.deleteTransaction(n,e,{force:t});return o.ok&&((0,r.revalidatePath)("/dashboard"),(0,r.revalidatePath)("/transactions"),(0,r.revalidatePath)("/assets"),(0,r.revalidatePath)("/credits"),(0,r.revalidatePath)("/receivables"),(0,r.revalidatePath)("/payables")),o}(0,a(85723).h)([O,L,F]),(0,n.j)("6b703e08827fbbce36cc78d17e626c0b091b048c",O),(0,n.j)("36a3d2901025964fa5525bd35b46cef5b61d199e",L),(0,n.j)("0b5e38c42b12e95d23213f3b3913ce7d6f09fe16",F)},10838:(e,t,a)=>{"use strict";a.d(t,{eI:()=>o,mq:()=>i});var n=a(96389),r=a(53973);function o(){let e=(0,r.cookies)();return(0,n.createServerClient)("https://yahocagtrxvevqhhlkln.supabase.co","sb_publishable_nxnr2DPKy2_DxjHQAn2Gyg_l81Qaspk",{cookies:{get:t=>e.get(t)?.value,set(t,a,n){try{e.set({name:t,value:a,...n})}catch{}},remove(t,a){try{e.set({name:t,value:"",...a})}catch{}}}})}function i(){return(0,n.createServerClient)("https://yahocagtrxvevqhhlkln.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY,{cookies:{get:()=>void 0,set:()=>{},remove:()=>{}},auth:{persistSession:!1,autoRefreshToken:!1}})}},11571:(e,t,a)=>{"use strict";a.d(t,{R:()=>r});var n=a(44067);class r{constructor(e){this.db=e}async query(e){try{let{data:t,error:a}=await e();if(a)return n.D.database(a.message??"Error de base de datos",a.details);if(null===t)return n.D.notFound("Registro");return{ok:!0,data:t}}catch(t){let e=t instanceof Error?t.message:"Error inesperado";return n.D.database(e)}}async queryNullable(e){try{let{data:t,error:a}=await e();if(a)return n.D.database(a.message??"Error de base de datos",a.details);return{ok:!0,data:t}}catch(t){let e=t instanceof Error?t.message:"Error inesperado";return n.D.database(e)}}async queryList(e){try{let{data:t,error:a}=await e();if(a)return n.D.database(a.message??"Error de base de datos",a.details);return{ok:!0,data:t??[]}}catch(t){let e=t instanceof Error?t.message:"Error inesperado";return n.D.database(e)}}}},44067:(e,t,a)=>{"use strict";a.d(t,{D:()=>o,ok:()=>n});let n=e=>({ok:!0,data:e}),r=e=>({ok:!1,error:e}),o={notFound:e=>r({code:"NOT_FOUND",message:`${e} no encontrado`}),unauthorized:()=>r({code:"UNAUTHORIZED",message:"No autorizado"}),validation:(e,t)=>r({code:"VALIDATION_ERROR",message:e,detail:t}),businessRule:(e,t)=>r({code:"BUSINESS_RULE_ERROR",message:e,detail:t}),database:(e,t)=>r({code:"DATABASE_ERROR",message:e,detail:t}),atomicityFailure:e=>r({code:"ATOMICITY_FAILURE",message:e})}}};