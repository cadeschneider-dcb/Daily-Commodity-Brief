export default async function handler(req, res) {
  try {
    const apiKey = process.env.ENERGY_PRICE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ENERGY_PRICE_API_KEY is not configured"
      });
    }

    const response = await fetch(
      "https://api.energypriceapi.com/v1/latest",
      {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok || data.success === false) {
      return res.status(response.status || 500).json({
        error: "EnergypriceAPI request failed",
        details: data
      });
    }

    // Cache the response so visitors don't unnecessarily
    // consume your EnergypriceAPI quota.
    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400"
    );

    return res.status(200).json(data);

  } catch (error) {
    console.error("Market API error:", error);

    return res.status(500).json({
      error: "Unable to retrieve market data"
    });
  }
}
