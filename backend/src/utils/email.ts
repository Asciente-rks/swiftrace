import nodemailer from "nodemailer";

export async function sendTrackingEmail(email: string, tracking_number: string) {
  const user = process.env.EMAIL_USER ?? process.env.GMAIL_USER;
  const pass = process.env.EMAIL_PASS ?? process.env.GMAIL_PASS;

  if (!user || !pass) {
    throw new Error("Email credentials are not configured.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: user,
    to: email,
    subject: "Your Shipment Tracking Number",
    text: `Your tracking number is: ${tracking_number}`,
  };

  await transporter.sendMail(mailOptions);
}