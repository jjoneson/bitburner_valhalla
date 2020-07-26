import {BitBurner as NS} from "Bitburner"

const server = "http://localhost:8088"
const files = [
    "val_cp.js",
    "val_crack.js",
    "val_init.js",
    "val_kill.js",
    "val_lib_constants.js",
    "val_lib_log.js",
    "val_lib_run.js",
    "val_lib_servers.js",
    "val_lib_stats.js",
    "val_update.js"
]

export const main = async function(ns: NS) {
    for (const file of files) {
        await ns.wget(`${server}/${file}`, `${file}`)
    }
}