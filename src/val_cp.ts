import type { BitBurner as NS } from "Bitburner"
import { getNewServers } from "./val_lib_servers.js"
import { scriptExtensions } from "./val_lib_constants.js";

export const main = async function (ns: NS) {
    const thisHost = ns.getHostname()

    const files = ns.ls(thisHost)
        .filter(file => scriptExtensions
            .some(ext => file.indexOf(ext) > 1))

    const servers = getNewServers(ns, new Array())
    
    servers.forEach(server => {
        if (server.static.name == thisHost) {
            return
        }
        ns.scp(files, server.static.name)
    })
}
