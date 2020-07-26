import type {BitBurner as NS} from "Bitburner"
import { ramCost, homeServer, serverNamePrefix, schedulingInterval, minimumCashReserves } from "./val_lib_constants.js";

export const main = async function(ns: NS) {
    while(!allServersMaxed(ns)) {
        let maxServers = ns.getPurchasedServerLimit()
        let ram = 2
        let purchasePrice = ram*ramCost;
        const maxPrice = ns.getPurchasedServerMaxRam()*ramCost
        while(purchasePrice < maxPrice && purchasePrice < (ns.getServerMoneyAvailable(homeServer) - minimumCashReserves)) {
            ram=ram*2
            purchasePrice = ram*ramCost
        }

        ram = ram/2

        let currentServers = ns.getPurchasedServers()
        for (let i = 0; i < maxServers; i++) {
            if(i > currentServers.length -1) {
                ns.purchaseServer(`${serverNamePrefix}${i}-${ram}GB`, ram)
                break;
            }
            if(ns.getServerRam(currentServers[i])[0] < ram) {
                ns.killall(currentServers[i])
                ns.deleteServer(currentServers[i])
                ns.purchaseServer(`${serverNamePrefix}${i}-${ram}GB`, ram)
                break;
            }
        }
        await ns.sleep(schedulingInterval)    
    }

    ns.spawn("stock-master.ns", 1)
}

const allServersMaxed = function(ns: NS): boolean {   
    if (ns.getPurchasedServers().length < ns.getPurchasedServerLimit()) return false
    
    for (const server of ns.getPurchasedServers()) {
        if (ns.getServerRam(server)[0] < ns.getPurchasedServerMaxRam()) return false
    }

    return true
}