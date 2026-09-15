export default async function handler(req, res) {
  try {
    const apiKey = process.env.ENERGY_PRICE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ENERGY_PRICE_API_KEY is not configured"
      });
    }

    // Compare today's stored observation with up to 7 days earlier.
    // This helps handle weekends, holidays, and daily-plan update timing.
    const end = new Date();
    const start = new Date();

    start.setUTCDate(end.getUTCDate() - 7);

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

    const symbols = ["WTI", "BRENT", "GASOLINE", "NATURALGAS"];
    const changes = {};

    for (const symbol of symbols) {
      const item = data.rates?.[symbol];

      if (!item || !item.start_rate || !item.end_rate) {
        changes[symbol] = null;
        continue;
      }

      // API rates are commodity units per USD.
      // Invert them to get the prices displayed on our dashboard.
      const startPrice = 1 / item.start_rate;
      const endPrice = 1 / item.end_rate;

      const dollarChange = endPrice - startPrice;
      const percentChange =
        (dollarChange / startPrice) * 100;

      changes[symbol] = {
        start_price: startPrice,
        end_price: endPrice,
        dollar_change: dollarChange,
        percent_change: percentChange
      };
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400"
    );

    return res.status(200).json({
      success: true,
      start_date: data.start_date,
      end_date: data.end_date,
      changes
    });

  } catch (error) {
    console.error("Change API error:", error);

    return res.status(500).json({
      error: "Unable to retrieve market changes"
    });
  }
}
