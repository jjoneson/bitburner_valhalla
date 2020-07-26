import type { BitBurner as NS } from "Bitburner"
import { Ports, Action, Status } from "./val_lib_enum"
import { ActionMessage } from "./val_lib_communication"
import { getCurrentServers, getTotalAvailableRam, Server } from "./val_lib_servers"
import { sortServersByValue, getHacksToTarget, getGrowthsToMax, getWeakensToZero } from "./val_lib_stats"
import { getExpectedFinishTime, getCurrentSeconds } from "./val_lib_math"

const global_servers = new Array


interface dispatchable {
    dispatch(ns: NS, operationTime: number, stats: {ram: number, expectedFinishTime: number}): void
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

    public dispatch(ns: NS, operationTime: number, stats: {ram: number, expectedFinishTime: number}): number {
        let scriptRam = ns.getScriptRam(this.action)
        let remainingRam = scriptRam * this.threads

        for (const server of getCurrentServers(ns, global_servers)) {
            if (this.threads <= 0) break

            const schedulableThreads = Math.floor(remainingRam / scriptRam)
            const scheduledThreads = schedulableThreads > this.threads ? this.threads : schedulableThreads 
            remainingRam -= scheduledThreads * scriptRam
            this.threads -= scheduledThreads

            ns.exec(this.action, server.static.name, scheduledThreads, this.target, scheduledThreads.toString())
            stats.expectedFinishTime =  getExpectedFinishTime(operationTime) 

            while (!ns.tryWrite(Ports.Actions, JSON.stringify(new ActionMessage(this.action, this.target, scheduledThreads, Status.Processing)))) {
               ns.sleep(100)
            }
        }
        stats.ram = getTotalAvailableRam(ns, global_servers)
        return this.threads
    }
}

const weaken = async function(ns: NS, target: Server, stats: {ram: number, expectedFinishTime: number}) {
    const totalWeakensNeeded = getWeakensToZero(ns, target)
    if (totalWeakensNeeded == 0) return

    const weakenAction = new DispatchAction(target.static.name, totalWeakensNeeded, Action.Weaken)
    while (weakenAction.dispatch(ns, target.dynamic.weakenTime, stats) > 0) {
        await ns.sleep(target.dynamic.weakenTime)
    }
}

const hack = async function(ns: NS, target: Server, stats: {ram: number, expectedFinishTime: number}) {
    const totalHacksNeeded = getHacksToTarget(ns, target)
    if (totalHacksNeeded == 0) return

    const hackAction = new DispatchAction(target.static.name, totalHacksNeeded, Action.Hack)
    while (hackAction.dispatch(ns, target.dynamic.hackTime, stats) > 0) {
        await ns.sleep(target.dynamic.hackTime)
    }
}

const grow = async function(ns: NS, target: Server, stats: {ram: number, expectedFinishTime: number}) {
    const totalGrowthsNeeded = getGrowthsToMax(ns, target)
    if (totalGrowthsNeeded == 0) return

    const growthAction = new DispatchAction(target.static.name, totalGrowthsNeeded, Action.Grow)
    while (growthAction.dispatch(ns, target.dynamic.growTime, stats) > 0) {
        await ns.sleep(target.dynamic.growTime)
    }
}

export const main = async function (ns: NS) {
    getCurrentServers(ns, global_servers)
    const stats = {ram: getTotalAvailableRam(ns, global_servers), expectedFinishTime: 0}
    while (true) {
        const targets = sortServersByValue(ns, getCurrentServers(ns, global_servers))
        for (const target of targets) {
            await weaken(ns, target, stats)
            await hack(ns, target, stats)
            await grow(ns, target, stats)
            if (stats.ram <= ns.getScriptRam(Action.Hack)) break
        }
        // Sleep for the length of the last scheduled script
        if (stats.ram < ns.getScriptRam(Action.Hack)) {
            const remainingTime = getCurrentSeconds() - stats.expectedFinishTime
            if (remainingTime > 0) await ns.sleep(1000*remainingTime)
            stats.expectedFinishTime = 0
        }
    }

}

