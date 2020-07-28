import type {BitBurner as NS} from "Bitburner"
import { homeServer, stockTradeComission } from "./val_lib_constants.js"
import { info } from "./val_lib_log.js"

let cashReservesLowPercent = 0.1
let cycles = 2

interface Stock {
    symbol: any
    price?: number
    maxShares?: number
    longShares?: number
    shortShares?: number
    totalShares?: number
    longPrice?: number
    shortPrice?: number
    volatility?: number
    probability?: number
    expectReturn?: number
}

interface StockReturn {
    stock: Stock
    shares: number
    position: Position
    profit: number
}

enum Position {
    Long,
    Short
}

export const main = async function(ns: NS) {
    ns.disableLog("ALL")
    const allStocks: Stock[] = new Array()
    const ownedStocks: Stock[] = new Array()
    let corpus = 0;

    ns.getStockSymbols().forEach(symbol => allStocks.push({symbol: symbol}))
    
    while(true){
        corpus = refreshStocks(ns, allStocks, ownedStocks)
        const topStock = allStocks[0]
        const bottomStock = allStocks[allStocks.length - 1]

        //Sell Long Positions if appropriate
        for (const ownedStock of ownedStocks) {
            if (!ownedStock.longShares || ownedStock.longShares == 0)
                continue
            if (topStock.expectReturn > ownedStock.expectReturn){
                sell(ns, ownedStock, ownedStock.longShares)
                corpus -= stockTradeComission
            }
        }

        //Sell Short Positions if appropriate
        for (const ownedStock of ownedStocks) {
            if (!ownedStock.shortShares || ownedStock.shortShares == 0)
                continue

            if (bottomStock.expectReturn < ownedStock.expectReturn){
                shortSell(ns, ownedStock, ownedStock.shortShares)
                corpus -= stockTradeComission
            }
        }

        //Sell Shares if Cash on Hand is Low
        const returns: StockReturn[] = new Array()
        for (const ownedStock of ownedStocks) {
            if (ns.getServerMoneyAvailable(homeServer) > minimumCashOnHand(ns, corpus)) {
                break
            }
            
            const cashNeeded = ns.getServerMoneyAvailable(homeServer) - minimumCashOnHand(ns, corpus)
            
            // Calculate Return for Long Shares
            if (ownedStock.longShares > 0) {
                let longShares = Math.floor(cashNeeded/ownedStock.longPrice)
                if (longShares > ownedStock.longShares) {
                    longShares = ownedStock.longShares
                }
                returns.push({
                    stock: ownedStock,
                    shares: longShares,
                    position: Position.Long,
                    profit: ns.getStockSaleGain(ownedStock.symbol, longShares, "long")
                })
            }
            //Calculate Return for Short Shares
            if (ownedStock.shortShares > 0) {
                let shortShares = Math.floor(cashNeeded/ownedStock.shortPrice)
                if (shortShares > ownedStock.shortShares) {
                    shortShares = ownedStock.shortShares
                }
                returns.push({
                    stock: ownedStock,
                    shares: shortShares,
                    position: Position.Short,
                    profit: ns.getStockSaleGain(ownedStock.symbol, shortShares, "short")
                })
            }
        }
        
        // Perform the Sales
        returns.sort((a, b) => a.profit - b.profit)
        for (const stockReturn of returns) {
            if (ns.getServerMoneyAvailable(homeServer) > minimumCashOnHand(ns, corpus)) {
                break
            }
            if (stockReturn.position == Position.Long) {
                sell(ns, stockReturn.stock, stockReturn.shares)
            } else if(stockReturn.position == Position.Short) {
                shortSell(ns, stockReturn.stock, stockReturn.shares)
            }
        }

        //Buy Long Shares with Cash on Hand
        let longShares = buyableShares(ns, topStock, corpus)
        if ((longShares * topStock.expectReturn * topStock.price * cycles) > stockTradeComission)
            buy(ns, topStock, longShares)

        let shortShares = shortableShares(ns, bottomStock, corpus)
        if ((shortShares * bottomStock.expectReturn * bottomStock.price * cycles * -1) > stockTradeComission)
            short(ns, bottomStock, shortShares)

        await ns.sleep(5 * 1000 * cycles + 200)
    }
}

const refreshStocks = function(ns: NS, allStocks: Stock[], ownedStocks: Stock[]): number {
    let corpus = ns.getServerMoneyAvailable(homeServer)
    ownedStocks.length = 0;

    for(const stock of allStocks) {
        let symbol = stock.symbol
        stock.price = ns.getStockPrice(symbol)
        stock.maxShares = ns.getStockMaxShares(symbol)
        stock.longShares = ns.getStockPosition(symbol)[0]
        stock.longPrice = ns.getStockPosition(symbol)[1]
        stock.shortShares = ns.getStockPosition(symbol)[2]
        stock.shortPrice = ns.getStockPosition(symbol)[3]
        stock.volatility = ns.getStockVolatility(symbol)
        stock.probability = 2 * (ns.getStockForecast(symbol) - 0.5)
        stock.expectReturn = stock.volatility * stock.probability / 2
        corpus += stock.longPrice * stock.longShares
        corpus += stock.shortPrice * stock.shortShares
        if(stock.longShares || stock.shortShares > 0) ownedStocks.push(stock)
    }
    allStocks.sort((a, b) => a.expectReturn - b.expectReturn)
    return corpus
}

const buy = function(ns: NS, stock: Stock, shares: number){
    ns.buyStock(stock.symbol, shares)
    info(ns, `Bought ${stock.symbol} for ${format(shares * stock.price)}`)
}

const short = function(ns: NS, stock: Stock, shares: number) {
    ns.shortStock(stock.symbol, shares)
    info(ns, `Bought Short on ${stock.symbol} for ${format(shares * stock.shortPrice)}`)
}

const sell = function(ns: NS, stock: Stock, shares: number) {
    let net = shares * (stock.price - stock.longPrice) - 2 * stockTradeComission
    ns.sellStock(stock.symbol, shares)
    let disposition = Math.sign(net) == 1 ? "profit" : "loss"
    info(ns, `Sold ${stock.symbol} for a ${disposition} of ${format(net)}`)
}

const shortSell = function(ns: NS, stock: Stock, shares: number) {
    let net = shares * (stock.price - stock.shortPrice) - 2 * stockTradeComission
    ns.sellShort(stock.symbol, shares)
    let disposition = Math.sign(net) == 1 ? "profit" : "loss"
    info(ns, `Short sold ${stock.symbol} for a ${disposition} of ${format(net)}`)
}

const minimumCashOnHand = function(ns: NS, corpus: number): number {
    return (ns.getServerMoneyAvailable(homeServer) + corpus) * cashReservesLowPercent
}

const shortableShares = function(ns: NS, stock: Stock, corpus: number): number {
    let spendableIncome = ns.getServerMoneyAvailable(homeServer) - minimumCashOnHand(ns, corpus)
    if (spendableIncome <= 0) return 0
    let shares = Math.floor((spendableIncome - stockTradeComission) / stock.price)
    if (shares > (stock.maxShares - stock.shortShares)) {
        shares = stock.maxShares - stock.shortShares - 1
    }
    return shares
}

const buyableShares = function(ns: NS, stock: Stock, corpus: number): number {
    let spendableIncome = ns.getServerMoneyAvailable(homeServer) - minimumCashOnHand(ns, corpus)
    if (spendableIncome <= 0) return 0
    let shares = Math.floor((spendableIncome - stockTradeComission) / stock.price)
    if (shares > (stock.maxShares - stock.longShares)) {
        shares = stock.maxShares - stock.longShares - 1
    }
    return shares
}

const format = function(amount: number): string{
    let symbols = ["","K","M","B","T","Qa","Qi","Sx","Sp","Oc"];
    let i = 0;
    for(; (Math.abs(amount) >= 1000) && (i < symbols.length); i++) amount /= 1000;
    return `${amount.toFixed(3)}${symbols[i]}`
}