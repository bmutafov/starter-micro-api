const http = require("http");
const mongoose = require("mongoose");
const axios = require("axios");

const RANGE_START = parseInt(process.env.RANGE_START);
const RANGE_END = parseInt(process.env.RANGE_END);

if (!RANGE_START || !RANGE_END) {
  console.error(
    `Need to configure both RANGE_START & RANGE_END .env variables`
  );
  process.exit(1);
}

if (isNaN(RANGE_START) || isNaN(RANGE_END)) {
  console.error(`RANGE_START & RANGE_END need to be numbers!`);
  process.exit(1);
}

const priceSchema = new mongoose.Schema({
  itemName: String,
  price: Number,
});

const priceModel = mongoose.model("price", priceSchema);

async function start() {
  const connection = await mongoose.connect(
    "mongodb+srv://test123:test123@cluster0.n1yw3.mongodb.net/cs-go?retryWrites=true&w=majority"
  );

  console.log("conneccted!");
  let start = RANGE_START;
  let totalCount = 100;
  const mutationPromises = [];

  while (true) {
    const result = await querySteamMarket({
      start,
      count: "100",
    });

    await parseResults(result.data.results);
    await sleep(2_000);
    start += result.data.pagesize;
    if (start > RANGE_END) {
      start = RANGE_START;
      await sleep(5_000);
    }
    totalCount = result.data.total_count;
  }
}

start();

async function querySteamMarket({ query, count, start }) {
  const searchParams = new URLSearchParams();
  searchParams.set("start", start?.toString() || "0");
  searchParams.set("count", count || "10");
  searchParams.set("norender", "1");
  searchParams.set("query", query || "");

  searchParams.set("appid", "730");

  const url = `https://steamcommunity.com/market/search/render/?${searchParams.toString()}`;

  const response = await axios.get(url, {
    validateStatus: () => true,
  });

  if (response.status === 200) console.log(`${start}: OK`);
  else console.log(`${start}: FAIL: ${response.status}`);

  return response;
}

async function parseResults(results) {
  return Promise.allSettled(
    results.map((result) => {
      const marketHashName = result.asset_description.market_hash_name;
      return priceModel
        .findOneAndUpdate(
          {
            itemName: marketHashName,
          },
          {
            itemName: marketHashName,
            price: result.sell_price,
            //   sellListings: result.sell_listings,
          },
          {
            upsert: true,
          }
        )
        .save();
    })
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
