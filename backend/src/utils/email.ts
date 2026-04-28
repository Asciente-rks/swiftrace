import nodemailer from "nodemailer";

export async function sendTrackingEmail(email: string, tracking_number: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Your Shipment Tracking Number",
    text: `Your tracking number is: ${tracking_number}`,
  };

  await transporter.sendMail(mailOptions);
}