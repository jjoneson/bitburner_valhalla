import type { BitBurner as NS } from "Bitburner"
import { getNewServers } from "./val_lib_servers.js"

export const main = async function (ns: NS) {
    const thisHost = ns.getHostname();
    const servers = getNewServers(ns, new Array())
    servers.forEach(server => {
        if (server.static.name == thisHost) {
            return
        }
        ns.killall(server.static.name)
    })
    ns.killall(thisHost)
}