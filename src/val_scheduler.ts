import type { BitBurner as NS } from "Bitburner"
import { Action, Status } from "./val_lib_enum.js"
import { ActionMessage } from "./val_lib_communication.js"
import { getCurrentServers, getTotalAvailableRam, Server, getRootedServers } from "./val_lib_servers.js"
import { sortServersByValue, getHacksToTarget, getGrowthsToMax, getWeakensToZero } from "./val_lib_stats.js"
import { getExpectedFinishTime } from "./val_lib_math.js"
import { info } from "./val_lib_log.js"
import { schedulingInterval } from "./val_lib_constants.js"

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
        ns.scp(this.action, this.target)
        let scriptRam = ns.getScriptRam(this.action)
        let remainingRam = scriptRam * this.threads

        for (const server of getCurrentServers(ns, global_servers)) {
            const schedulableThreads = Math.floor(remainingRam / scriptRam)
            if (schedulableThreads <= 0) {
                this.threads = 0
                break
            } 

            const scheduledThreads = schedulableThreads > this.threads ? this.threads : schedulableThreads 
            remainingRam -= scheduledThreads * scriptRam
            this.threads -= scheduledThreads

            ns.exec(this.action, server.static.name, scheduledThreads, this.target, scheduledThreads.toString())
            stats.expectedFinishTime =  getExpectedFinishTime(operationTime) 
            info(ns, JSON.stringify(new ActionMessage(this.action, this.target, scheduledThreads, Status.Processing, operationTime), null, 2))
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
        info(ns, `Could not dispatch all weakens for ${target.static.name}.  Sleeping for ${target.dynamic.weakenTime}`)
        await ns.sleep(target.dynamic.weakenTime)
    }
}

const hack = async function(ns: NS, target: Server, stats: {ram: number, expectedFinishTime: number}) {
    if (getWeakensToZero(ns, target) > 0) return 0
    const totalHacksNeeded = getHacksToTarget(ns, target)
    if (totalHacksNeeded == 0) return

    const hackAction = new DispatchAction(target.static.name, totalHacksNeeded, Action.Hack)
    while (hackAction.dispatch(ns, target.dynamic.hackTime, stats) > 0) {
        info(ns, `Could not dispatch all hacks for ${target.static.name}.  Sleeping for ${target.dynamic.hackTime}`)
        await ns.sleep(target.dynamic.hackTime)
    }
}

const grow = async function(ns: NS, target: Server, stats: {ram: number, expectedFinishTime: number}) {
    if (getWeakensToZero(ns, target) > 0) return 0

    const totalGrowthsNeeded = getGrowthsToMax(ns, target)
    if (totalGrowthsNeeded == 0) return

    const growthAction = new DispatchAction(target.static.name, totalGrowthsNeeded, Action.Grow)
    while (growthAction.dispatch(ns, target.dynamic.growTime, stats) > 0) {
        info(ns, `Could not dispatch all growths for ${target.static.name}.  Sleeping for ${target.dynamic.growTime}`)
        await ns.sleep(target.dynamic.growTime)
    }
}

export const main = async function (ns: NS) {
    ns.disableLog("ALL")
    getCurrentServers(ns, global_servers)
    const stats = {ram: getTotalAvailableRam(ns, global_servers), expectedFinishTime: 0}
    while (true) {
        const targets = sortServersByValue(ns, getRootedServers(ns, global_servers))
        for (const target of targets) {
            await weaken(ns, target, stats)
            await hack(ns, target, stats)
            await grow(ns, target, stats)
            if (stats.ram <= ns.getScriptRam(Action.Hack)) break
        }
        await ns.sleep(schedulingInterval)
    }
}

