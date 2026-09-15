export default async function handler(req, res) {
  try {
    const apiKey = process.env.EIA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "EIA_API_KEY is not configured"
      });
    }

    const url =
      "https://api.eia.gov/v2/petroleum/stoc/wstk/data/" +
      `?api_key=${apiKey}` +
      "&frequency=weekly" +
      "&data[0]=value" +
      "&facets[product][]=EPC0" +
      "&facets[process][]=SAXL" +
      "&facets[duoarea][]=NUS" +
      "&sort[0][column]=period" +
      "&sort[0][direction]=desc" +
      "&offset=0" +
      "&length=2";

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "EIA request failed",
        details: data
      });
    }

    const rows = data.response?.data;

    if (!rows || rows.length < 2) {
      return res.status(500).json({
        error: "Not enough EIA observations",
        details: data
      });
    }

    const latest = rows[0];
    const previous = rows[1];

    const latestValue = Number(latest.value);
    const previousValue = Number(previous.value);

    const weeklyChange =
      latestValue - previousValue;

    const weeklyPercentChange =
      (weeklyChange / previousValue) * 100;

    return res.status(200).json({
      success: true,

      crude_inventory: {
        series:
          "U.S. Commercial Crude Oil Inventories",

        definition:
          "Ending stocks excluding SPR and lease stocks",

        unit:
          "thousand barrels",

        latest_date:
          latest.period,

        previous_date:
          previous.period,

        latest:
          latestValue,

        previous:
          previousValue,

        weekly_change:
          weeklyChange,

        weekly_change_mmbbl:
          weeklyChange / 1000,

        weekly_percent_change:
          weeklyPercentChange
      }
    });

  } catch (error) {
    console.error("EIA API error:", error);

    return res.status(500).json({
      error:
        "Unable to retrieve EIA data"
    });
  }
}
