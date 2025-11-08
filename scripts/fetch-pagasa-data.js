// This is a simple script to fetch and display PAGASA data for debugging
// Run with: node scripts/fetch-pagasa-data.js

const https = require("https")

// Function to make a GET request
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ""

        res.on("data", (chunk) => {
          data += chunk
        })

        res.on("end", () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        })
      })
      .on("error", (err) => {
        reject(err)
      })
  })
}

async function main() {
  try {
    console.log("Fetching PAGASA tropical cyclone data...")
    const cycloneData = await httpGet("https://bagong.pagasa.dost.gov.ph/tropical-cyclone/api")
    console.log("Tropical Cyclone Data:")
    console.log(JSON.stringify(cycloneData, null, 2))

    // You can add more API endpoints to test here
  } catch (error) {
    console.error("Error fetching PAGASA data:", error)
  }
}

main()
