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

  const invitationLink = `${process.env.APP_URL}/invitations`;
  const html = `
<p>Bonjour ${user ? user.firstname : ""},</p>
<p>Vous avez reçu une invitation à l'évènement ${
    event.event_name
  } qui aura lieu le ${event.event_date.toLocaleDateString()}.</p>
<p>Veuillez installer l'application ou vous connecter pour accepter ou décliner l'invitation.</p>
<a href="${invitationLink}">Voir l'invitation</a>
`;

  const text = `
Bonjour ${user ? user.firstname : ""},

Vous avez reçu une invitation à l'évènement ${
    event.event_name
  } qui aura lieu le ${event.event_date.toLocaleDateString()}.

Veuillez installer l'application ou vous connecter pour accepter ou décliner l'invitation en cliquant sur ce lien :
${invitationLink}
`;

  sendMail(to, subject, text, html);
};

module.exports = { sendInvitationEmail };
