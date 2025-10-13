const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendMail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: `Giftsquad <${process.env.MAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email envoyé à ${to}`);
  } catch (error) {
    console.error("Erreur lors de l’envoi d’email :", error);
  }
};

const sendInvitationEmail = (event, email, user) => {
  const to = user
    ? `"${user.firstname} ${user.lastname}" <${user.email}>`
    : email;

  const subject = `🎁 Invitation à ${event.event_name}`;
  const hasAccount = !!user;
  const baseUrl = process.env.APP_URL;

  const acceptLink = `${baseUrl}/event/${event._id}/participant/accept?email=${encodeURIComponent(email)}`;
  const declineLink = `${baseUrl}/event/${event._id}/participant/decline?email=${encodeURIComponent(email)}`;

  const eventTypeMapping = {
    secret_santa: "Secret Santa",
    birthday: "Anniversaire",
    christmas_list: "Liste de Noël",
  };

  const eventType = eventTypeMapping[event.event_type] ?? "Événement";
  const date = new Date(event.event_date).toLocaleDateString("fr-FR");
  const budget = event.event_budget ? `<p><strong>Budget conseillé :</strong> ${event.event_budget} €</p>` : "";

  // URL du logo Cloudinary
  const logoUrl = "https://res.cloudinary.com/dertejtfm/image/upload/v1760355211/Giftsquad_logo_vjs7kf.png";

  const html = `
  <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 30px;">
    <div style="background: white; margin: auto; border-radius: 8px; padding: 25px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
      
      <div style="text-align:center; margin-bottom: 25px;">
        <img src="${logoUrl}" alt="Logo Giftsquad" style="max-width: 140px; height: auto;" />
      </div>

      <h2 style="color: #4CAF50; text-align: center; margin-bottom: 20px;">Invitation à ${event.event_name}</h2>

      <p>Bonjour ${email.split("@")[0]},</p>

      <p>Vous êtes invité(e) à participer à <strong>${event.event_name}</strong> (${eventType}), prévu le <strong>${date}</strong>.</p>
      ${budget}

      ${
        hasAccount
          ? `
        <div style="margin: 30px 0;">
          <a href="${acceptLink}" style="background-color:#4CAF50;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;margin:5px;">Accepter</a>
          <a href="${declineLink}" style="background-color:#f44336;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;margin:5px;">Refuser</a>
        </div>
        `
          : `
        <div style="background:#fff3cd;border:1px solid #ffeeba;border-radius:6px;padding:15px;margin:25px 0;">
          <p style="margin:0;color:#856404;"><strong>⚠️ Vous n'avez pas encore de compte Giftsquad.</strong></p>
          <p>Pour accepter cette invitation :</p>
          <ol style="margin:10px 0 0 20px;color:#856404;">
            <li>Créez un compte sur l’application Giftsquad</li>
            <li>Rendez-vous dans la section <em>“Invitations”</em> pour confirmer votre participation</li>
          </ol>
        </div>
        `
      }

      <p style="font-size:12px;color:#999;text-align:center;margin-top:40px;">
        Cet email a été envoyé automatiquement par Giftsquad. Ne répondez pas directement à ce message.
      </p>
    </div>
  </div>
  `;

  const text = `
Invitation à ${event.event_name}

<p>Bonjour ${email.split("@")[0]},</p>,

Vous êtes invité(e) à l’événement "${event.event_name}" (${eventType}), prévu le ${date}.
${event.event_budget ? `Budget conseillé : ${event.event_budget} €` : ""}

${
  hasAccount
    ? `
Accepter : ${acceptLink}
Refuser : ${declineLink}
`
    : `
Vous devez d'abord créer un compte sur l'application Giftsquad,
puis accepter l'invitation depuis la section "Invitations".
`
}
`;

  sendMail(to, subject, text, html);
};

module.exports = { sendInvitationEmail };
