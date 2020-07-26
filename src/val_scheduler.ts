import type { BitBurner as NS } from "Bitburner"
import { Ports, Action, Status } from "./val_lib_enum"
import { ActionMessage } from "./val_lib_communication"
import { getCurrentServers, getTotalAvailableRam } from "./val_lib_servers"
import { sortServersByValue, getHacksToTarget, getGrowthsToMax, getWeakensToZero } from "./val_lib_stats"

const global_servers = new Array


interface dispatchable {
    dispatch(ns: NS): void
}

class DispatchAction implements dispatchable {
    target: string
    threads: number
    action: Action

    constructor(target: string, threads: number, action: Action) {
        this.target = target
        this.threads = threads
        this.action = action
    }

    public dispatch(ns: NS): number {
        let scriptRam = ns.getScriptRam(this.action)
        let remainingRam = scriptRam * this.threads
        let remainingThreads = this.threads

        for (const server of getCurrentServers(ns, global_servers)) {
            if (remainingThreads <= 0) break

            const schedulableThreads = Math.floor(remainingRam / scriptRam)
            const scheduledThreads = schedulableThreads > remainingThreads ? remainingThreads : schedulableThreads 
            remainingRam -= schedulableThreads * scriptRam
            remainingThreads -= schedulableThreads

            ns.exec(this.action, server.static.name, scheduledThreads, this.target, scheduledThreads.toString())

            while (!ns.tryWrite(Ports.Actions, JSON.stringify(new ActionMessage(this.action, this.target, scheduledThreads, Status.Processing)))) {
               ns.sleep(100)
            }
        }
        return remainingThreads
    }
}


export const main = async function (ns: NS) {
    getCurrentServers(ns, global_servers)
    while (true) {
        const targets = sortServersByValue(ns, getCurrentServers(ns, global_servers))
        let availableRam = getTotalAvailableRam(ns, global_servers)
        let maxTime = 0
        for (const target of targets) {
            maxTime = 0
            // Do Weakening
            const weakenAction = new DispatchAction(target.static.name, getWeakensToZero(ns, target), Action.Weaken)
            while (weakenAction.dispatch(ns) > 0) {
                maxTime = maxTime < target.dynamic.weakenTime ? target.dynamic.weakenTime : maxTime
                await ns.sleep(target.dynamic.weakenTime)
            }
            availableRam = getTotalAvailableRam(ns, global_servers)

            // Do Hacking
            const hackAction = new DispatchAction(target.static.name, getHacksToTarget(ns, target), Action.Hack)
            while (hackAction.dispatch(ns) > 0) {
                maxTime = maxTime < target.dynamic.hackTime ? target.dynamic.hackTime : maxTime
                await ns.sleep(target.dynamic.hackTime)
            }
            availableRam = getTotalAvailableRam(ns, global_servers)

            // Do Growing
            const growthAction = new DispatchAction(target.static.name, getGrowthsToMax(ns, target), Action.Grow)
            while (growthAction.dispatch(ns) > 0) {
                maxTime = maxTime < target.dynamic.growTime ? target.dynamic.growTime : maxTime
                await ns.sleep(target.dynamic.growTime)
            }
            availableRam = getTotalAvailableRam(ns, global_servers)

            if (availableRam <= ns.getScriptRam(Action.Hack)) break
        }
        // Sleep for the length of the current longest running script
        if (availableRam < ns.getScriptRam(Action.Hack)) {
            await ns.sleep(maxTime)
        }
    }

}

