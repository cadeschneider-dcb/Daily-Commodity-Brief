export default async function handler(req, res) {
  try {
    const apiKey = process.env.ENERGY_PRICE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ENERGY_PRICE_API_KEY is not configured"
      });
    }

    // Get today's date and yesterday's date
    const end = new Date();
    const start = new Date();

    start.setUTCDate(end.getUTCDate() - 1);

    const formatDate = (date) =>
      date.toISOString().split("T")[0];

    const startDate = formatDate(start);
    const endDate = formatDate(end);

    const url =
      `https://api.energypriceapi.com/v1/change` +
      `?base=USD` +
      `&start_date=${startDate}` +
      `&end_date=${endDate}`;

    const response = await fetch(url, {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      return res.status(response.status || 500).json({
        error: "EnergypriceAPI change request failed",
        details: data
      });
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400"
    );

    return res.status(200).json(data);

  } catch (error) {
    console.error("Change API error:", error);

    return res.status(500).json({
      error: "Unable to retrieve market changes"
    });
  }
}
