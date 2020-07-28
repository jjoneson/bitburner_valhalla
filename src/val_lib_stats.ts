import type {BitBurner as NS} from "Bitburner"
import { Server } from "./val_lib_servers.js"
import { weakenAmount, desiredMoneyRatio, serverNamePrefix, homeServer } from "./val_lib_constants.js"

export const getWeakenTimeToZero = function(ns: NS, server: Server): number {
    return server.dynamic.weakenTime * getWeakensToZero(ns, server)
}

export const getWeakensToZero = function(ns: NS, server: Server): number {
    return Math.ceil((server.dynamic.currentSecurityLevel - server.static.minSecurityLevel) / weakenAmount)
}

export const getGrowthTimeToMax = function(ns: NS, server: Server): number {
    return getGrowthsToMax(ns, server) * server.dynamic.growTime
}

export const getGrowthsToMax = function(ns: NS, server: Server): number {
    if(server.static.maxMoney == 0) return 0
    if(server.static.maxMoney - server.dynamic.currentMoney <= 0) return 0
    return ns.growthAnalyze(server.static.name, server.static.maxMoney - server.dynamic.currentMoney)
}

export const getHackDeficit = function(ns: NS, server: Server): number {
    if (server.static.maxMoney == 0) return 0
    return server.dynamic.currentMoney - server.static.maxMoney * desiredMoneyRatio
}

export const getHacksToTarget = function(ns: NS, server: Server): number {
    if(!server.dynamic.hackable) return 0
    const deficit = getHackDeficit(ns, server)
    if (deficit <= 0) return 0

    return ns.hackAnalyzeThreads(server.static.name, deficit)
}

export const getHackChance = function(ns: NS, server: Server): number {
    let skillMulti = (1.75*ns.getHackingLevel())
    let difficultyMulti = (100 - server.dynamic.currentSecurityLevel) / 100
    let skillChance = 1 - (server.static.requiredHackingLevel / skillMulti)
    return skillChance * difficultyMulti
}

export const getHackTimeToTarget = function(ns: NS, server: Server): number {
    return getHacksToTarget(ns, server) * server.dynamic.hackTime / getHackChance(ns, server)
}

export const getServerValue = function(ns: NS, server: Server): number {
    if (server.static.maxMoney == 0) return 0
    if (server.static.name.startsWith(serverNamePrefix)) return 0
    if (server.static.name == homeServer) return 0
    if (server.static.name == "darkweb") return 0
    
    let growthTimeToMax = getGrowthTimeToMax(ns, server)
    if (growthTimeToMax <= 0) {
        growthTimeToMax = 0.1
    }
    let hackTimeToMax = getHackTimeToTarget(ns, server)
    if (hackTimeToMax <= 0) {
        hackTimeToMax = 0.1
    }
    let weakenTimeToZero = getWeakenTimeToZero(ns, server)
    if (weakenTimeToZero <= 0) {
        weakenTimeToZero = 0.1
    }
    return server.static.maxMoney/(growthTimeToMax+hackTimeToMax+weakenTimeToZero)
}

export const sortServersByValue = function(ns: NS, servers: Server[]): Server[] {
    return servers.sort((a, b) => getServerValue(ns, b) - getServerValue(ns, a))
}
