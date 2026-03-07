import axios from "axios";

// Generate a random OTP
function generateOTP(length = 6) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// POST method to send OTP
export async function POST(req) {
  try {
    // Parse the request body
    const body = await req.json();
    const { phoneNumber,name } = body;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ message: "Phone number is required" }),
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Fast2SMS API Configuration
    const apiKey = "2MnRj7gKhSaQ8u3zOyTtqbVdfF5YN1Lrks6weB0PXCIpvUA4m9nRZcVPmYBCz7IH2FvUg1l3A0w8yJ4j"; // Replace with your Fast2SMS API key
    const senderId = "You and Me"; // Replace with your sender ID if applicable
    const message = `Dear ${name || "User"}, your OTP for UnMe verification is ${otp}. Please use this code within 10 minutes to complete the process. Do not share this OTP with anyone.`;
    const route = "q"; // Promotional or transactional route
    const numbers = phoneNumber;

    // Send OTP via Fast2SMS
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        message,
        route,
        numbers,
        schedule_time:"",
        flash:0,
        sender_id: senderId,
      },
      {
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.return) {
      return new Response(
        JSON.stringify({ message: "OTP sent successfully", otp }),
        { status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({ message: "Failed to send OTP", error: response.data }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({ message: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
