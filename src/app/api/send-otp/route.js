export async function POST(req) {
    const { phone, otp } = await req.json();
    const url = `https://api.onex-aura.com/api/sms?key=Jihy6Nu8&from=VOGMNE&to=91${phone}&body=Your%UnME%20verification%20code%20is%3A%20${otp}&templateid=1007953066931428625&entityid=1001034262507596869`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const data = await response.json();
        console.log("Response from SMS API:", data);
        return Response.json(data);
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}