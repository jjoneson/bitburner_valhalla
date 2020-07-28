import type { BitBurner as NS } from "Bitburner"
import { serverNamePrefix, homeServer } from "./val_lib_constants.js"
import { sortServersByValue } from "./val_lib_stats.js"
import { warn, info } from "./val_lib_log.js"

export interface ServerStaticProps {
    name: string
    requiredHackingLevel: number
    requiredPortsOpen: number
    totalRam: number
    maxMoney: number
    minSecurityLevel: number
    growth: number

}

export interface ServerDynamicProps {
    currentSecurityLevel: number
    currentMoney: number
    availableRam: number
    rooted: boolean
    hackable: boolean
    weakenTime: number
    growTime: number
    hackTime: number
}

export interface ServerCalculatedProps {
    hackRatio?: number
}

export class Server {
    public static: ServerStaticProps
    public dynamic: ServerDynamicProps

    constructor(ns: NS, hostName: string) {
        this.static = {
            name: hostName,
            requiredHackingLevel: ns.getServerRequiredHackingLevel(hostName),
            maxMoney: ns.getServerMaxMoney(hostName),
            minSecurityLevel: ns.getServerMinSecurityLevel(hostName),
            requiredPortsOpen: ns.getServerNumPortsRequired(hostName),
            totalRam: ns.getServerRam(hostName)[0],
            growth: ns.getServerGrowth(hostName)
        }
    }

    public updateDynamicProps(ns: NS) {
        this.dynamic = {
            availableRam: this.static.totalRam - ns.getServerRam(this.static.name)[1],
            currentSecurityLevel: ns.getServerSecurityLevel(this.static.name),
            hackable: ns.getServerRequiredHackingLevel(this.static.name) <= ns.getHackingLevel(),
            rooted: ns.hasRootAccess(this.static.name),
            weakenTime: ns.getWeakenTime(this.static.name),
            growTime: ns.getGrowTime(this.static.name),
            hackTime: ns.getHackTime(this.static.name),
            currentMoney: ns.getServerMoneyAvailable(this.static.name),
        }
    }
}

export const getNewServers = function (ns: NS, servers?: Server[]): Server[] {
    if (!servers) {
        servers = new Array();
    }

    const thisHost = ns.getHostname()
    if (!servers.some(server => server.static.name == thisHost))
        servers.push(new Server(ns, thisHost))

    for (let i = 0; i < servers.length; i++) {
        if (servers[i].static.name.startsWith(serverNamePrefix)) continue
        try {
            ns.scan(servers[i].static.name).forEach(hostName => {
                if (!servers.some(server => server.static.name == hostName)) {
                    try {
                        servers.push(new Server(ns, hostName))
                    } catch (error) {
                        warn(ns, error.message, error.stacktrace)
                    }
                }
            })
        } catch (error) {
            warn(ns, error.message, error.stack)
        }
    }

    for (const purchased of ns.getPurchasedServers()) {
        if (!servers.some(server => server.static.name == purchased))
            try {
                servers.push(new Server(ns, purchased))
            } catch{ }
    }
    return servers;
}

export const getCurrentServers = function (ns: NS, servers: Server[]): Server[] {
    for (const server of getNewServers(ns, servers)) {
        try {
            server.updateDynamicProps(ns)
        } catch {
            servers.splice(servers.findIndex(serv => serv.static.name == server.static.name), 1)
        }
    }
    return servers
}

export const getRootedServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => server.dynamic.rooted)
}

export const getSortedTargetServers = function (ns: NS, servers: Server[]): Server[] {
    return sortServersByValue(ns, getTargetableServers(ns, servers))
}

export const getTargetableServers = function (ns: NS, servers: Server[]): Server[] {
    // while (servers.some(serv => serv.static.name.startsWith(serverNamePrefix))) {
    //     servers.splice(servers.findIndex(serv => serv.static.name.startsWith(serverNamePrefix)), 1)
    // }

    // while (servers.some(serv => serv.static.maxMoney == 0)) {
    //     servers.splice(servers.findIndex(serv => serv.static.maxMoney == 0), 1)
    // }

    // servers.splice(servers.findIndex(serv => serv.static.name == homeServer), 1)
    // servers.splice(servers.findIndex(serv => serv.static.name == "darkweb"), 1)
    return servers
}

export const getUnrootedServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => !server.dynamic.rooted)
}

export const getHackableServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => server.dynamic.hackable && server.dynamic.rooted)
}

export const getUnhackableServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => !server.dynamic.hackable || !server.dynamic.rooted)
}

export const getTotalAvailableRam = function (ns: NS, servers: Server[]): number {
    let availableRam = 0
    for (const server of getRootedServers(ns, servers))
        availableRam += server.dynamic.availableRam

    return availableRam
}

export const getTotalMaximumRam = function (ns: NS, servers: Server[]): number {
    let maxRam = 0
    for (const server of getRootedServers(ns, servers))
        maxRam += server.static.totalRam

    return maxRam
}