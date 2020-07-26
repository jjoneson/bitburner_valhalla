import type { BitBurner as NS } from "Bitburner"
import { Ports, PortInfo } from "./val_lib_enum.js"
import { ActionMessage } from "./val_lib_communication.js"
import { info } from "./val_lib_log.js"

export const main = async function (ns: NS) {
    ns.disableLog("ALL")
    while (true) {
        const message = ns.read(Ports.Actions) as string
        if (message == PortInfo.Empty) {
            await ns.sleep(1000)
            continue
        }
        const actionMessage: ActionMessage = JSON.parse(message)
        info(ns, message, false)
    }
}