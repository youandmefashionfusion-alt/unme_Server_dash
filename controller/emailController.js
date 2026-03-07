import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, text, htmlContent }) => {
  try {
    // Set up the nodemailer transporter with Gmail
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: process.env.MAIL_ID, // Your Gmail ID from env
        pass: process.env.MAIL_PASSWORD, // Your Gmail password from env
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: '"UnMe Jewels" <youandme@gmail.com>', // Sender address
      to, // Receiver
      subject, // Subject of the email
      text, // Plain text body
      html: htmlContent, // HTML body (if any)
    });

    console.log("Message sent: %s", info.messageId);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

export default sendEmail;
