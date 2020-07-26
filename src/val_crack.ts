import type { BitBurner as NS } from "Bitburner"
import { getUnrootedServers } from "./val_lib_servers.js"
import { schedulingInterval } from "./val_lib_constants.js"
import { info } from "./val_lib_log.js"

export const main = async function (ns: NS) {
    let servers = getUnrootedServers(ns, new Array())
    while (true) {
        servers = getUnrootedServers(ns, servers)
        if (servers.length == 0) break
        for (const server of servers) {
            crack(ns, server.static.name)
            try {
                ns.nuke(server.static.name) 
            } catch(error) {
                info(ns, JSON.stringify(error))
            }
        }
        await ns.sleep(schedulingInterval)
    }
}

const programs = function(ns: NS) {
    return [
        ns.brutessh,
        ns.ftpcrack,
        ns.relaysmtp,
        ns.httpworm,
        ns.sqlinject
    ]
}

const crack = function (ns: NS, target: string) {
    for (const program of programs(ns)) {
        try {
            program(target)
        } catch(error) {
            info(ns, JSON.stringify(error))
        }
    } 
}