import type {BitBurner as NS} from "Bitburner"

export interface ServerStaticProps {
    name:string
    requiredHackingLevel:number
    requiredPortsOpen:number
    totalRam:number
    maxMoney:number
    minSecurityLevel:number
    growth:number

}

export interface ServerDynamicProps {
    currentSecurityLevel:number
    currentMoney:number
    availableRam:number
    rooted:boolean
    hackable:boolean
    weakenTime:number
    growTime:number
    hackTime:number
}

export interface ServerCalculatedProps {
    hackRatio?:number
}

export class Server {
    public static:ServerStaticProps
    public dynamic:ServerDynamicProps
    
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
            availableRam: ns.getServerRam(this.static.name)[1],
            currentSecurityLevel: ns.getServerSecurityLevel(this.static.name),
            hackable: ns.getServerRequiredHackingLevel(this.static.name) <= ns.getHackingLevel(),
            rooted: ns.hasRootAccess(this.static.name),
            weakenTime: ns.getWeakenTime(this.static.name),
            growTime: ns.getGrowTime(this.static.name),
            hackTime: ns.getHackTime(this.static.name),
            currentMoney: ns.getServerMoneyAvailable(this.static.name)
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
        ns.scan(servers[i].static.name).forEach(hostName => {
            if (!servers.some(server => server.static.name == hostName)) {
                servers.push(new Server(ns, hostName))
            }
        });
    }
    return servers;
}

export const getCurrentServers = function(ns: NS, servers: Server[]): Server[] {
    getNewServers(ns, servers).forEach(server => server.updateDynamicProps(ns))
    return servers
}

export const getRootedServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => server.dynamic.rooted)
}

export const getUnrootedServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => !server.dynamic.rooted)
}

export const getHackableServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => server.dynamic.hackable)
}

export const getUnhackableServers = function (ns: NS, servers: Server[]): Server[] {
    return getCurrentServers(ns, servers).filter(server => !server.dynamic.hackable)
}

export const getTotalAvailableRam = function (ns: NS, servers: Server[]): number {
    let availableRam = 0
    for(const server of getCurrentServers(ns, servers))
        availableRam += server.dynamic.availableRam
    
    return availableRam
}