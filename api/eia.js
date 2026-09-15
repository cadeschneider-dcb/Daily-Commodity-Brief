export default async function handler(req, res) {
  try {
    const apiKey = process.env.EIA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "EIA_API_KEY is not configured"
      });
    }

    const baseUrl =
      "https://api.eia.gov/v2/petroleum/stoc/wstk/data/";

    // Helper function to request the latest two observations
    async function getEiaData(params) {
      const query =
        `?api_key=${apiKey}` +
        "&frequency=weekly" +
        "&data[0]=value" +
        params +
        "&sort[0][column]=period" +
        "&sort[0][direction]=desc" +
        "&offset=0" +
        "&length=2";

      const response = await fetch(baseUrl + query);
      const data = await response.json();

      if (!response.ok) {
        throw new Error("EIA request failed");
      }

      const rows = data.response?.data;

      if (!rows || rows.length < 2) {
        throw new Error("Not enough EIA observations");
      }

      return rows;
    }

    // -----------------------------
    // 1. U.S. COMMERCIAL CRUDE
    // -----------------------------

    const crudeRows = await getEiaData(
      "&facets[product][]=EPC0" +
      "&facets[process][]=SAX" +
      "&facets[duoarea][]=NUS"
    );

    // -----------------------------
    // 2. CUSHING CRUDE
    // -----------------------------

    const cushingRows = await getEiaData(
      "&facets[series][]=W_EPC0_SAX_YCUOK_MBBL"
    );

    // -----------------------------
    // 3. TOTAL MOTOR GASOLINE
    // -----------------------------

    const gasolineRows = await getEiaData(
      "&facets[product][]=EPM0" +
      "&facets[process][]=SAE" +
      "&facets[duoarea][]=NUS"
    );

    // -----------------------------
    // 4. DISTILLATE FUEL OIL
    // -----------------------------

    const distillateRows = await getEiaData(
      "&facets[product][]=EPD0" +
      "&facets[process][]=SAE" +
      "&facets[duoarea][]=NUS"
    );

    // Convert each pair of observations
    // into dashboard-ready information.
    function calculateMetric(rows, name) {
      const latest = rows[0];
      const previous = rows[1];

      const latestValue = Number(latest.value);
      const previousValue = Number(previous.value);

      const weeklyChange =
        latestValue - previousValue;

      const percentChange =
        (weeklyChange / previousValue) * 100;

      return {
        name,

        unit: "thousand barrels",

        latest_date: latest.period,
        previous_date: previous.period,

        latest: latestValue,
        previous: previousValue,

        latest_mmbbl:
          latestValue / 1000,

        weekly_change:
          weeklyChange,

        weekly_change_mmbbl:
          weeklyChange / 1000,

        weekly_percent_change:
          percentChange
      };
    }

    const result = {
      success: true,

      crude_inventory: calculateMetric(
        crudeRows,
        "U.S. Commercial Crude Oil"
      ),

      cushing_inventory: calculateMetric(
        cushingRows,
        "Cushing Crude Oil"
      ),

      gasoline_inventory: calculateMetric(
        gasolineRows,
        "U.S. Total Motor Gasoline"
      ),

      distillate_inventory: calculateMetric(
        distillateRows,
        "U.S. Distillate Fuel Oil"
      )
    };

    // EIA updates weekly, so cache the result.
    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400"
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("EIA API error:", error);

    return res.status(500).json({
      error: "Unable to retrieve EIA data",
      details: error.message
    });
  }
}
