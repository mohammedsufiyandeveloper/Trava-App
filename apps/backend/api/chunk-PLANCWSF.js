import{a as i}from"./chunk-SBQDH4TM.js";import{a as t}from"./chunk-SQDVCCE7.js";import{betterAuth as d}from"better-auth";import{prismaAdapter as p}from"better-auth/adapters/prisma";import{emailOTP as m,admin as g,phoneNumber as u}from"better-auth/plugins";import c from"nodemailer";var a=c.createTransport({host:i.SMTP_HOST,port:Number(i.SMTP_PORT),secure:i.SMTP_SECURE,auth:{user:i.SMTP_USER,pass:i.SMTP_PASSWORD},tls:{rejectUnauthorized:!1}});process.env.NEXT_PHASE!=="phase-production-build"&&a.verify(function(e,o){e&&console.error("SMTP Connection Error:",e)});async function s({to:e,subject:o,html:n,from:l}){try{let r=await a.sendMail({from:l||`"Tusker Management" <${i.SMTP_FROM}>`,to:Array.isArray(e)?e.join(", "):e,subject:o,html:n});return console.log("Email sent successfully:",r.messageId),{success:!0,messageId:r.messageId,data:r}}catch(r){return console.error("Error sending email:",r),{success:!1,error:r instanceof Error?r.message:"Failed to send email"}}}var P=d({database:p(t,{provider:"postgresql"}),user:{},session:{expiresIn:3600*24*7,updateAge:3600*24,cookieCache:{enabled:!0,maxAge:300}},emailAndPassword:{enabled:!0,requireEmailVerification:!0,sendResetPassword:async({user:e,url:o})=>{await s({to:e.email,subject:"Reset your password",html:`<p>Click <a href="${o}">here</a> to reset your password.</p>`})}},emailVerification:{sendOnSignUp:!0,autoSignInAfterVerification:!0,sendVerificationEmail:async({user:e,url:o,token:n})=>{console.log(`
==============================================`),console.log("\u{1F4E7} EMAIL VERIFICATION LINK"),console.log("=============================================="),console.log("User:",e.email),console.log("Name:",e.name||"N/A"),console.log("Verification URL:",o),console.log("Token:",n),console.log(`==============================================
`),await s({to:e.email,subject:"Verify your email address",html:`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Tusker Management!</h2>
            <p>Hi ${e.name||e.email},</p>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${o}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
              If you didn't create this account, you can safely ignore this email.
            </p>
          </div>
        `})}},socialProviders:{google:{clientId:i.GOOGLE_CLIENT_ID,clientSecret:i.GOOGLE_CLIENT_SECRET}},plugins:[m({async sendVerificationOTP({email:e,otp:o}){console.log(`
==============================================`),console.log("\u{1F4E7} EMAIL OTP"),console.log("=============================================="),console.log("Email:",e),console.log("OTP:",o),console.log(`==============================================
`),await s({to:e,subject:"Tusker Management - Verify your email",html:`<p>Your OTP is <strong>${o}</strong></p>`})}}),u({signUpOnVerification:{getTempEmail:e=>`${e.replace("+","")}@tusker.temp`,getTempName:e=>`User ${e}`},async sendOTP({phoneNumber:e,code:o},n){console.log(`
==============================================`),console.log("\u{1F4F1} PHONE OTP"),console.log("=============================================="),console.log("Phone:",e),console.log("OTP:",o),console.log(`==============================================
`)}}),g()],databaseHooks:{session:{create:{after:async e=>{let{recordActivity:o}=await import("./audit-3IZZ46WW.js");await o({userId:e.userId,action:"USER_LOGIN",ipAddress:e.ipAddress??void 0,userAgent:e.userAgent??void 0})}}}}});export{P as a};
