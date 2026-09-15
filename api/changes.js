export default async function handler(req, res) {
  try {
    const apiKey = process.env.ENERGY_PRICE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ENERGY_PRICE_API_KEY is not configured"
      });
    }

    const headers = {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    };

    // Get the latest available prices
    const latestResponse = await fetch(
      "https://api.energypriceapi.com/v1/latest",
      { headers }
    );

    const latestData = await latestResponse.json();

    if (!latestResponse.ok || latestData.success === false) {
      return res.status(500).json({
        error: "Unable to retrieve latest prices",
        details: latestData
      });
    }

    // The timestamp tells us when the latest observation is from.
    const latestDate = new Date(latestData.timestamp * 1000);

    // Start with the previous calendar day.
    const previousDate = new Date(latestDate);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    // If latest observation is Monday, compare with Friday.
    // If latest observation is Sunday, compare with Friday.
    // If latest observation is Saturday, compare with Friday.
    const day = latestDate.getUTCDay();

    if (day === 1) {
      previousDate.setUTCDate(latestDate.getUTCDate() - 3);
    } else if (day === 0) {
      previousDate.setUTCDate(latestDate.getUTCDate() - 2);
    } else if (day === 6) {
      previousDate.setUTCDate(latestDate.getUTCDate() - 1);
    }

    const formatDate = (date) =>
      date.toISOString().split("T")[0];

    const previousDateString = formatDate(previousDate);
    const latestDateString = formatDate(latestDate);

    // Get the previous available daily observation
    const historicalResponse = await fetch(
      `https://api.energypriceapi.com/v1/${previousDateString}`,
      { headers }
    );

    const historicalData = await historicalResponse.json();

    if (
      !historicalResponse.ok ||
      historicalData.success === false
    ) {
      return res.status(500).json({
        error: "Unable to retrieve previous prices",
        details: historicalData
      });
    }

    const symbols = [
      "WTI",
      "BRENT",
      "GASOLINE",
      "NATURALGAS"
    ];

    const changes = {};

    for (const symbol of symbols) {
      const latestRate = latestData.rates?.[symbol];
      const previousRate = historicalData.rates?.[symbol];

      if (!latestRate || !previousRate) {
        changes[symbol] = null;
        continue;
      }

      // EnergypriceAPI returns commodity units per USD.
      // Invert to obtain USD per commodity unit.
      const currentPrice = 1 / latestRate;
      const previousPrice = 1 / previousRate;

      const dollarChange =
        currentPrice - previousPrice;

      const percentChange =
        (dollarChange / previousPrice) * 100;

      changes[symbol] = {
        previous_price: previousPrice,
        current_price: currentPrice,
        dollar_change: dollarChange,
        percent_change: percentChange
      };
    }

    // Cache heavily because the free plan only updates daily.
    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400"
    );

    return res.status(200).json({
      success: true,
      previous_date: previousDateString,
      latest_date: latestDateString,
      changes
    });

  } catch (error) {
    console.error("Daily change API error:", error);

    return res.status(500).json({
      error: "Unable to calculate daily market changes"
    });
  }
}
