import type { BitBurner as NS } from "Bitburner"
import { getNewServers } from "./val_lib_servers.js"
import { global_servers } from "./val_init.js";

export const main = async function (ns: NS) {
    const thisHost = ns.getHostname();
    const servers = getNewServers(ns, global_servers)
    servers.forEach(server => {
        if (server.static.name == thisHost) {
            return
        }
        ns.killall(server.static.name)
    })
    ns.killall(thisHost)
}