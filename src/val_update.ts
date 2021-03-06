import {BitBurner as NS} from "Bitburner"
import { initScript, homeServer, copyScript } from "./val_lib_constants.js"

const server = "http://localhost:8088"
const files = [
    "val_cp.js",
    "val_crack.js",
    "val_grow.js",
    "val_hack.js",
    "val_init.js",
    "val_kill.js",
    "val_lib_communication.js",
    "val_lib_constants.js",
    "val_lib_enum.js",
    "val_lib_log.js",
    "val_lib_math.js",
    "val_lib_run.js",
    "val_lib_servers.js",
    "val_lib_stats.js",
    "val_listener.js",
    "val_ram.js",
    "val_scheduler.js",
    "val_stocks.js",
    "val_update.js",
    "val_weaken.js"
]

export const main = async function(ns: NS) {
    for (const file of files) {
        await ns.wget(`${server}/${file}`, `${file}`)
    }
    ns.exec(copyScript, homeServer)
    ns.exec(initScript, homeServer)
}