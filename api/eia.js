export default async function handler(req, res) {
  try {
    const apiKey = process.env.EIA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "EIA_API_KEY is not configured"
      });
    }

    // -----------------------------------
    // EIA API ROUTES
    // -----------------------------------

    const stocksUrl =
      "https://api.eia.gov/v2/petroleum/stoc/wstk/data/";

    const productionUrl =
      "https://api.eia.gov/v2/petroleum/sum/sndw/data/";

    const utilizationUrl =
      "https://api.eia.gov/v2/petroleum/pnp/wiup/data/";


    // -----------------------------------
    // GENERIC EIA REQUEST
    // -----------------------------------

    async function getEiaData(baseUrl, params) {
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
        throw new Error(
          "Not enough EIA observations"
        );
      }

      return rows;
    }


    // -----------------------------------
    // INVENTORIES
    // -----------------------------------

    const crudeRows = await getEiaData(
      stocksUrl,
      "&facets[product][]=EPC0" +
      "&facets[process][]=SAXL" +
      "&facets[duoarea][]=NUS"
    );

    const cushingRows = await getEiaData(
      stocksUrl,
      "&facets[series][]=W_EPC0_SAX_YCUOK_MBBL"
    );

    const gasolineRows = await getEiaData(
      stocksUrl,
      "&facets[product][]=EPM0" +
      "&facets[process][]=SAE" +
      "&facets[duoarea][]=NUS"
    );

    const distillateRows = await getEiaData(
      stocksUrl,
      "&facets[product][]=EPD0" +
      "&facets[process][]=SAE" +
      "&facets[duoarea][]=NUS"
    );


    // -----------------------------------
    // U.S. CRUDE PRODUCTION
    // -----------------------------------

    const productionRows = await getEiaData(
      productionUrl,
      "&facets[process][]=FPF" +
      "&facets[duoarea][]=NUS"
    );


    // -----------------------------------
    // REFINERY UTILIZATION
    // -----------------------------------

    const utilizationRows = await getEiaData(
      utilizationUrl,
      "&facets[process][]=YUP" +
      "&facets[duoarea][]=NUS"
    );


    // -----------------------------------
    // INVENTORY CALCULATOR
    // -----------------------------------

    function calculateInventory(rows, name) {
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


    // -----------------------------------
    // PRODUCTION CALCULATOR
    // -----------------------------------

    function calculateProduction(rows) {
      const latest = rows[0];
      const previous = rows[1];

      const latestValue = Number(latest.value);
      const previousValue = Number(previous.value);

      const change =
        latestValue - previousValue;

      return {
        name: "U.S. Crude Oil Production",

        unit: "thousand barrels per day",

        latest_date: latest.period,
        previous_date: previous.period,

        latest: latestValue,
        previous: previousValue,

        latest_mmbd:
          latestValue / 1000,

        previous_mmbd:
          previousValue / 1000,

        weekly_change:
          change,

        weekly_change_mmbd:
          change / 1000,

        weekly_percent_change:
          (change / previousValue) * 100
      };
    }


    // -----------------------------------
    // UTILIZATION CALCULATOR
    // -----------------------------------

    function calculateUtilization(rows) {
      const latest = rows[0];
      const previous = rows[1];

      const latestValue = Number(latest.value);
      const previousValue = Number(previous.value);

      return {
        name: "U.S. Refinery Utilization",

        unit: "percent",

        latest_date: latest.period,
        previous_date: previous.period,

        latest: latestValue,
        previous: previousValue,

        weekly_change_points:
          latestValue - previousValue,

        weekly_percent_change:
          ((latestValue / previousValue) - 1) * 100
      };
    }


    // -----------------------------------
    // FINAL RESPONSE
    // -----------------------------------

    const result = {
      success: true,

      crude_inventory:
        calculateInventory(
          crudeRows,
          "U.S. Commercial Crude Oil"
        ),

      cushing_inventory:
        calculateInventory(
          cushingRows,
          "Cushing Crude Oil"
        ),

      gasoline_inventory:
        calculateInventory(
          gasolineRows,
          "U.S. Total Motor Gasoline"
        ),

      distillate_inventory:
        calculateInventory(
          distillateRows,
          "U.S. Distillate Fuel Oil"
        ),

      crude_production:
        calculateProduction(
          productionRows
        ),

      refinery_utilization:
        calculateUtilization(
          utilizationRows
        )
    };


    // -----------------------------------
    // CACHE
    // -----------------------------------

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
