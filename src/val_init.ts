import type {BitBurner as NS} from "Bitburner"
import { getCurrentServers } from "./val_lib_servers.js"
import { startupScripts } from "./val_lib_constants.js"

export const global_servers = new Array()

export const main = async function(ns: NS) {
    getCurrentServers(ns, global_servers)
    startupScripts.forEach(script => ns.spawn(script, 1))
}