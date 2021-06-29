const Discord = require("./discord.js-self/src")
const axios = require("axios")
const config = require("./config.json")
const fs = require("fs")
const prices = {}
const tokens = require("./tokens.json")
const coins = require("./coins.json")
const { normalizeFields } = require("./discord.js-self/src/structures/MessageEmbed")
const Client = new Discord.Client()

function updateConfig() {
  fs.writeFileSync("./config.json", JSON.stringify(config))
}

Number.prototype.f = function(p) {
  let parts
  if (p) {
    parts = this.toFixed(p).split(".")
  } else {
    parts = this.toString().split(".")
  }
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return parts.join(".")
};

(async () => {


await updatePrices()
console.log("got prices")
setInterval(updatePrices, 15000)
Client.login(config.owner.token)
Client.on("ready", () => {
  console.log("ready")
  updateStatus()
  setInterval(updateStatus, 10000)
})

Client.on("message", async (msg) => {
  if (!config.whitelist.includes(msg.author.id)) return
  if (msg.content == "!nw") {
    const values = Object.keys(config.symbols).map(symbol => [symbol, config.symbols[symbol], prices[symbol]])
    const nwEmbed = {
      color: 0xa600ff,
      title: `💰  ${config.owner.name}'s Net Worth`,
      description: `**USD: $${values.reduce((a, c) => a + (c[2].priceUSD * c[1]), 0).f(2)}\nETH: ${values.reduce((a, c) => a + (c[2].priceETH * c[1]), 0).f(4)} ETH**`,
      fields: [],
      thumbnail: {
        url: config.owner.pfpURL
      }
    }
    for (let i = 0; i < values.length; i++) {
      nwEmbed.fields.push({
        name: values[i][2].name,
        value: `${values[i][1].f(4)} ${values[i][0].toUpperCase()}\n≈ **$${(values[i][1] * values[i][2].priceUSD).f(2)}**`,
        inline: true
      })
      if (i % 2 == 0) {
        nwEmbed.fields.push({
          name: "\u200b",
          value: "\u200b",
          inline: true
        })
      }
    }
    msg.channel.send({embed: nwEmbed})
  }
  if (msg.author.id != config.owner.id) return
  if (msg.content.startsWith("!cs ")) {
    const args = msg.content.split(" ").slice(1)
    if (args.length > 0) {
      config.status.symbol = args[0].toLowerCase()
      if (args[1] && args[1] == +args[1]) { config.status.precision = +args[1] }
      updateConfig()
      await updateStatus()
      msg.react("✅").catch()
    } else {
      msg.react("😡").catch()
    }
  } else if (msg.content.startsWith("!us ")) {
    const args = msg.content.split(" ").slice(1)
    if (args.length > 2) {
      if (args[2] == +args[2]) {
        if (args[1] == "=") {
          if (+args[2] == 0) {
            delete config.symbols[args[0].toLowerCase()]
          } else {
            config.symbols[args[0].toLowerCase()] = +args[2]
          }
        } else if (args[1] == "+") {
          if (!config.symbols[args[0].toLowerCase()]) {
            config.symbols[args[0].toLowerCase()] = 0
          }
          config.symbols[args[0].toLowerCase()] += +args[2]
        }else {
          msg.react("😡").catch()
          return
        }
      } else {
        msg.react("😡").catch()
        return
      }
      updateConfig()
      await updatePrices()
      msg.react("✅").catch()
    } else {
      msg.react("😡").catch()
    }
  } else if (msg.content.startsWith("!uw ")) {
    const args = msg.content.split(" ").slice(1)
    if (args.length > 1) {
      if (args[0] == "+") {
        if (!config.whitelist.includes(args[1])) {
          config.whitelist.push(args[1])
        }  
      } else if (args[0] == "-") {
        if (config.whitelist.includes(args[1])) {
          config.whitelist.splice(config.whitelist.indexOf(args[1]))
        }
      }
      updateConfig()
      msg.react("✅").catch()
    } else {
      msg.react("😡").catch()
    }
  }
})

})()


async function updateStatus() {
  if (config.status) {
    Client.user.setActivity(`${config.status.symbol.toUpperCase()}: $${prices[config.status.symbol].priceUSD.f(config.status.precision)}`, { type: 'WATCHING' }).catch(console.log)
  }
}

async function updatePrices() {
  await Promise.all([...Object.keys(config.symbols), config.status.symbol].map(async (symbol) => {prices[symbol] = await getValue(symbol)}))
}

async function getValue(token) {
  if (coins[token.toUpperCase()]) {
    token = token.toUpperCase()
    const price = await axios(`https://api.coingecko.com/api/v3/simple/price?ids=${coins[token]}&vs_currencies=usd,eth`)
    return {priceUSD: price.data[coins[token]].usd, priceETH: price.data[coins[token]].eth, name: coins[token][0].toUpperCase() + coins[token].slice(1)}
  } else {
    if (token == token.toLowerCase() || token == token.toUpperCase()) {
      token = token.toUpperCase()
    }
    
    // Get Uniswap value
    const [eth, id] = await Promise.all([
        getETHPrice(),
        tokens[token] ? axios({
          url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
          method: "POST",
          headers: { 
              "content-type": "application/json"
          },
          data: {
              operationName: "tokens",
              query: `query tokens($id: String) {
                asSymbol: tokens(where: {id: $id}) {
                  id
                  name
                }
              }`,
              variables: {
                  id: tokens[token]
              }
          }
      }) : axios({
            url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            data: {
                operationName: "tokens",
                query: `query tokens($symbol: String) {
                  asSymbol: tokens(where: {symbol: $symbol}, orderBy: tradeVolumeUSD, orderDirection: desc) {
                    id
                    name
                  }
                }`,
                variables: {
                    symbol: token
                }
            }
        })
    ])

    const tokenData = id.data?.data?.asSymbol[0]
    if (!tokenData) return
    const tokenId = tokenData.id
    const tokenName = tokenData.name
    let tokenPriceETH = await axios({
      url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
      method: "POST",
      headers: { 
          "content-type": "application/json"
      },
      data: {
          operationName: "pairs",
          query: `query pairs($id: String) {
            asId: pairs(where: {token0: $id, token1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"}) {
              id
              token1Price
              reserve0
              reserve1
              volumeUSD
            }
          }`,
          variables: {
              id: (tokens[token] ? tokens[token] : tokenId)
          }
      }
    })
    if (tokenPriceETH.data?.data?.asId[0]) {
      return {priceETH: +tokenPriceETH.data.data.asId[0].token1Price, priceUSD: tokenPriceETH.data.data.asId[0].token1Price * eth, name: tokenName, id: tokenId, tokenReserve: +tokenPriceETH.data.data.asId[0].reserve0, ethReserve: +tokenPriceETH.data.data.asId[0].reserve1, pairId: tokenPriceETH.data.data.asId[0].id, volumeUSD: +tokenPriceETH.data.data.asId[0].volumeUSD}
    } else {
      tokenPriceETH = await axios({
        url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
        method: "POST",
        headers: { 
            "content-type": "application/json"
        },
        data: {
            operationName: "pairs",
            query: `query pairs($id: String) {
              asId: pairs(where: {token0: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", token1: $id}) {
                id
                token0Price
                reserve0
                reserve1
                volumeUSD
              }
            }`,
            variables: {
                id: (tokens[token] ? tokens[token] : tokenId)
            }
        }
      })
      if (tokenPriceETH.data?.data?.asId[0]) {
        return {priceETH: +tokenPriceETH.data.data.asId[0].token0Price, priceUSD: tokenPriceETH.data.data.asId[0].token0Price * eth, name: tokenName, id: tokenId, tokenReserve: +tokenPriceETH.data.data.asId[0].reserve1, ethReserve: +tokenPriceETH.data.data.asId[0].reserve0, pairId: tokenPriceETH.data.data.asId[0].id, volumeUSD: +tokenPriceETH.data.data.asId[0].volumeUSD}
      } else {
        return
      }
    }
  }
}

async function getETHPrice() {
  return (await axios("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")).data.ethereum.usd
}