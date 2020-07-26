import type {BitBurner as NS} from "Bitburner"
import { startupScripts, homeServer, killScript } from "./val_lib_constants.js"

export const main = async function(ns: NS) {
    startupScripts.forEach(script => {
        if (ns.scriptRunning(script, homeServer)) {
            ns.scriptKill(script, homeServer)
        }
        ns.exec(script, homeServer)
    })
}