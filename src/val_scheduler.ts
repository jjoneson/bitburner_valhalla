import type { BitBurner as NS } from "Bitburner"
import { Action, Status } from "./val_lib_enum.js"
import { ActionMessage } from "./val_lib_communication.js"
import { getCurrentServers, getTotalAvailableRam, Server, getRootedServers, getSortedTargetServers, getHackableServers } from "./val_lib_servers.js"
import { getGrowthsToMax, getWeakensToZero } from "./val_lib_stats.js"
import { info } from "./val_lib_log.js"
import { schedulingInterval, weakensPerHack, weakensPerGrow, maxGrowBatchSize } from "./val_lib_constants.js"

const global_servers: Server[] = new Array()


class DispatchAction {
    target: string
    threads: number
    action: Action

    constructor(target: string, threads: number, action: Action) {
        this.target = target
        this.threads = Math.ceil(threads)
        this.action = action
    }

    public async dispatch(ns: NS, operationTime: number, initialDelay: number): Promise<number> {
        const servers = getRootedServers(ns, new Array())

        for (const server of servers) {
            let scriptRam = ns.getScriptRam(this.action, server.static.name)
            if (this.threads <= 0) break

            const schedulableThreads = Math.floor(server.dynamic.availableRam / scriptRam)
            if (schedulableThreads <= 0) continue

            const scheduledThreads = schedulableThreads >= this.threads ? this.threads : schedulableThreads
            this.threads -= scheduledThreads

            ns.scp(this.action, server.static.name)
            let delay = initialDelay
            if (ns.exec(this.action, server.static.name, scheduledThreads, this.target, scheduledThreads.toString(), delay.toString(), (new Date()).getTime().toString()) == 0) {
                continue
            }
            info(ns, JSON.stringify(new ActionMessage(this.action, this.target, scheduledThreads, Status.Processing, operationTime), null, 2))
        }
        getTotalAvailableRam(ns, servers)
        return this.threads
    }
}

const reap = async function (ns: NS, target: Server) {
    const totalWeakensNeeded = getWeakensToZero(ns, target)
    let totalGrowsNeeded = getGrowthsToMax(ns, target)
    const longestTime = getLongestOperationTime(target)
    const growDelay = longestTime - target.dynamic.growTime
    const hackDelay = longestTime - target.dynamic.hackTime
    const weakenDelay = longestTime - target.dynamic.weakenTime

    //Initial Weaken Period

    if (totalWeakensNeeded > 0) {
        const weakenAction = new DispatchAction(target.static.name, totalWeakensNeeded, Action.Weaken)
        while (await weakenAction.dispatch(ns, target.dynamic.weakenTime, 0) > 0) {
            info(ns, `Could not dispatch all weakens for ${target.static.name}.  Sleeping for ${target.dynamic.weakenTime}`)
            await ns.sleep(target.dynamic.weakenTime)
        }
        return
    }


    //Initial Growth Period
    if (totalGrowsNeeded > 0) {
        for (; totalGrowsNeeded > 0; totalGrowsNeeded -= maxGrowBatchSize) {
            let grows = (totalGrowsNeeded > maxGrowBatchSize) ? maxGrowBatchSize : totalGrowsNeeded
            let weakenBatch = Math.ceil(grows / weakensPerGrow)

            const growAction = new DispatchAction(target.static.name, grows, Action.Grow)
            while (await growAction.dispatch(ns, target.dynamic.growTime, growDelay) > 0) {
                info(ns, `Could not dispatch all grows for ${target.static.name}.  Sleeping for ${target.dynamic.growTime}`)
                await ns.sleep(target.dynamic.growTime)
            }

            const weakenAction = new DispatchAction(target.static.name, weakenBatch, Action.Weaken)
            while (await weakenAction.dispatch(ns, target.dynamic.weakenTime, weakenDelay) > 0) {
                info(ns, `Could not dispatch all weakens for ${target.static.name}.  Sleeping for ${target.dynamic.weakenTime}`)
                await ns.sleep(target.dynamic.weakenTime)
            }
        }
    }

    let incrementalHacksNeeded = ns.hackAnalyzeThreads(target.static.name, target.static.maxMoney * 0.1)
    let incremantalGrowthsNeeded = ns.growthAnalyze(target.static.name, target.static.maxMoney * 0.1)


    const hackAction = new DispatchAction(target.static.name, incrementalHacksNeeded, Action.Hack)
    while (await hackAction.dispatch(ns, target.dynamic.hackTime,hackDelay + schedulingInterval) > 0) {
        info(ns, `Could not dispatch all hacks for ${target.static.name}.  Sleeping for ${target.dynamic.hackTime}`)
        await ns.sleep(target.dynamic.hackTime)
    }

    let weakenBatchSize = Math.ceil(incrementalHacksNeeded / weakensPerHack)

    const weakenAction = new DispatchAction(target.static.name, weakenBatchSize, Action.Weaken)
    while (await weakenAction.dispatch(ns, target.dynamic.weakenTime, weakenDelay + schedulingInterval) > 0) {
        info(ns, `Could not dispatch all weakens for ${target.static.name}.  Sleeping for ${target.dynamic.weakenTime}`)
        await ns.sleep(target.dynamic.weakenTime)
    }

    const growAction = new DispatchAction(target.static.name, incremantalGrowthsNeeded, Action.Grow)
    while (await growAction.dispatch(ns, target.dynamic.growTime, growDelay + schedulingInterval) > 0) {
        info(ns, `Could not dispatch all grows for ${target.static.name}.  Sleeping for ${target.dynamic.growTime}`)
        return
    }

    weakenBatchSize = Math.ceil(incremantalGrowthsNeeded / weakensPerGrow)

    const growWeakenAction = new DispatchAction(target.static.name, weakenBatchSize, Action.Weaken)
    while (await growWeakenAction.dispatch(ns, target.dynamic.weakenTime, weakenDelay + schedulingInterval) > 0) {
        info(ns, `Could not dispatch all weakens for ${target.static.name}.  Sleeping for ${target.dynamic.weakenTime}`)
        await ns.sleep(target.dynamic.weakenTime)
    }
}

export const getLongestOperationTime = function(server: Server): number {
    let times = [server.dynamic.hackTime, server.dynamic.growTime, server.dynamic.weakenTime]
    times.sort((a, b) => a - b)
    return times.pop()
}

export const main = async function (ns: NS) {
    ns.disableLog("ALL")
    getCurrentServers(ns, global_servers)
    const stats = { ram: getTotalAvailableRam(ns, global_servers), expectedFinishTime: 0 }

    while (true) {
        let targets = getSortedTargetServers(ns, getHackableServers(ns, new Array()))
        if (targets.length == 0) {
            await ns.sleep(10000)
            continue
        }
        await reap(ns, targets[0])
        await ns.sleep(10000)
    }
}

