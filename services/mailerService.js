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
  const baseUrl = process.env.API_URL;
  const acceptLink = `${baseUrl}/event/${
    event._id
  }/participant/accept?email=${encodeURIComponent(email)}`;
  const declineLink = `${baseUrl}/event/${
    event._id
  }/participant/decline?email=${encodeURIComponent(email)}`;

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
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${acceptLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block; font-weight: bold;">✅ Accepter l'invitation</a>
    
    <a href="${declineLink}" style="background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block; font-weight: bold;">❌ Décliner l'invitation</a>
  </div>
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

Pour accepter l'invitation, cliquez sur ce lien :
${acceptLink}

Pour décliner l'invitation, cliquez sur ce lien :
${declineLink}`;

  sendMail(to, subject, text, html);
};

module.exports = { sendInvitationEmail };
