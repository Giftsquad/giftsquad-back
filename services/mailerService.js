const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: "giftsquad758@gmail.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});

const sendMail = (to, subject, text, html) => {
  (async () => {
    await transporter.sendMail({
      from: "Giftsquad <giftsquad758@gmail.com>",
      to,
      subject,
      text,
      html,
    });
  })();
};

const sendInvitationEmail = (event, email, user) => {
  const to = user
    ? `"${user.firstname} ${user.lastname}" <${user.email}>`
    : email;

  const subject = `Invitation à ${event.event_name}`;

  // Liens pour accepter et décliner l'invitation (directement vers le backend)
  const baseUrl = process.env.APP_URL;
  const acceptLink = `${baseUrl}/event/${
    event._id
  }/participant/accept?email=${encodeURIComponent(email)}`;
  const declineLink = `${baseUrl}/event/${
    event._id
  }/participant/decline?email=${encodeURIComponent(email)}`;

  // Message différent selon si l'utilisateur a un compte ou non
  const hasAccount = !!user;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #4CAF50; text-align: center;">Invitation à ${
    event.event_name
  }</h2>
  
  <p>Bonjour ${user ? user.firstname : email.split("@")[0]},</p>
  
  <p>Vous avez reçu une invitation à l'événement <strong>${
    event.event_name
  }</strong> qui aura lieu le ${new Date(event.event_date).toLocaleDateString(
    "fr-FR"
  )}.</p>
  
  <p><strong>Type d'événement :</strong> ${event.event_type}</p>
  ${
    event.event_budget
      ? `<p><strong>Budget conseillé :</strong> ${event.event_budget}€</p>`
      : ""
  }
  
  ${
    hasAccount
      ? `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${acceptLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block; font-weight: bold;">✅ Accepter l'invitation</a>
    
    <a href="${declineLink}" style="background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block; font-weight: bold;">❌ Décliner l'invitation</a>
  </div>
  `
      : `
  <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; color: #856404;"><strong>⚠️ Important :</strong> Vous n'avez pas encore de compte sur Giftsquad.</p>
    <p style="margin: 10px 0 0 0; color: #856404;">Pour accepter cette invitation, vous devez d'abord :</p>
    <ol style="margin: 10px 0 0 0; color: #856404;">
      <li>Créer un compte sur l'application Giftsquad</li>
      <li>Puis accepter l'invitation depuis la section "Invitations" de l'application</li>
    </ol>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #666; font-size: 14px;">Une fois votre compte créé, vous pourrez accepter cette invitation directement dans l'application.</p>
  </div>
  `
  }
</div>
`;

  // text = Fallback pour les clients email basiques ou quand HTML est désactivé
  const text = `
Invitation à ${event.event_name}

Bonjour ${user ? user.firstname : email.split("@")[0]},

Vous avez reçu une invitation à l'événement ${
    event.event_name
  } qui aura lieu le ${new Date(event.event_date).toLocaleDateString("fr-FR")}.

Type d'événement : ${event.event_type}
${event.event_budget ? `Budget conseillé : ${event.event_budget}€` : ""}

${
  hasAccount
    ? `
Pour accepter l'invitation, cliquez sur ce lien :
${acceptLink}

Pour décliner l'invitation, cliquez sur ce lien :
${declineLink}
`
    : `
IMPORTANT : Vous n'avez pas encore de compte sur Giftsquad.

Pour accepter cette invitation, vous devez d'abord :
1. Créer un compte sur l'application Giftsquad
2. Puis accepter l'invitation depuis la section "Invitations" de l'application

Une fois votre compte créé, vous pourrez accepter cette invitation directement dans l'application.
`
}`;

  sendMail(to, subject, text, html);
};

module.exports = { sendInvitationEmail };
