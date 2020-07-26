import type { BitBurner as NS } from "Bitburner"
import { Ports, PortInfo, Status } from "./val_lib_enum"
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

        if (actionMessage.status == Status.Complete) {
            while (!ns.tryWrite(Ports.Scheduling, actionMessage.target)) {
                await ns.sleep(100)
            }
        }
    }
}