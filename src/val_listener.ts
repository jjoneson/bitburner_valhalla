import type { BitBurner as NS } from "Bitburner"
import { Ports, PortInfo } from "./val_lib_enum"
import { ActionMessage } from "./val_lib_communication"
import { info } from "./val_lib_log"

export const main = async function (ns: NS) {
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