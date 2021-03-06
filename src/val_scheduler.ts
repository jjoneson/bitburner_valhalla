import type { BitBurner as NS } from "Bitburner"
import { Action, Status } from "./val_lib_enum.js"
import { ActionMessage } from "./val_lib_communication.js"
import { getTotalAvailableRam, Server, getRootedServers, getSortedTargetServers, getHackableServers } from "./val_lib_servers.js"
import { getGrowthsToMax, getWeakensToZero, getHacksToTarget } from "./val_lib_stats.js"
import { info, warn } from "./val_lib_log.js"
import { schedulingInterval, weakensPerHack, weakensPerGrow, maxGrowBatchSize, jobSegmentSpacing, desiredMoneyRatio } from "./val_lib_constants.js"


class Stats {
    origin: number
    initializationTime: number
    minHackTime: number
    minGrowTime: number
    minWeakenTime: number
    growDelay: number
    hackDelay: number
    weakenDelay: number
    growThreads: number
    hackThreads: number
    longestOperationTime: number

    constructor(origin: number) {
        this.origin = origin
        this.initializationTime = 0
        this.minWeakenTime = Number.MAX_VALUE
        this.minHackTime = Number.MAX_VALUE
        this.minGrowTime = Number.MAX_VALUE
        this.growDelay = 0
        this.hackDelay = 0
        this.weakenDelay = 0
        this.growThreads = 0
        this.hackThreads = 0
        this.longestOperationTime = 0
    }

    update(ns: NS, server: Server): Stats {
        let hostname = server.static.name
        this.minHackTime = ns.getHackTime(hostname) < this.minHackTime ? ns.getHackTime(hostname) : this.minHackTime
        this.minGrowTime = ns.getGrowTime(hostname) < this.minGrowTime ? ns.getGrowTime(hostname) : this.minGrowTime
        this.minWeakenTime = ns.getWeakenTime(hostname) < this.minWeakenTime ? ns.getWeakenTime(hostname) : this.minWeakenTime
        this.longestOperationTime = this.getLongestOperationTime()
        this.growDelay = this.longestOperationTime * 1000 - this.minGrowTime * 1000
        this.weakenDelay = this.longestOperationTime * 1000 - this.minWeakenTime * 1000
        this.hackDelay = this.longestOperationTime * 1000 - this.minHackTime * 1000
        if (server.dynamic.currentMoney > server.static.maxMoney * desiredMoneyRatio - 0.02 && server.dynamic.currentMoney <= server.static.maxMoney * desiredMoneyRatio) {
            this.growThreads = getGrowthsToMax(ns, server)
        }
        if (server.dynamic.currentMoney >= server.static.maxMoney) {
            this.hackThreads = getHacksToTarget(ns, server)
        }
        return this
    }

    getLongestOperationTime = function (): number {
        let times = [this.minHackTime, this.minGrowTime, this.minWeakenTime]
        times.sort((a, b) => a - b)
        return times.pop()
    }

    getInitializationDelay(delay: number, operationTime: number): number {
        const remainingTime = this.getInitializationTimeRemaining()
        if (remainingTime > (operationTime + delay)) {
            return remainingTime - operationTime - delay
        }
        return delay
    }

    getInitializationTimeRemaining(): number {
        return new Date().getTime() - this.initializationTime
    }
}

const targets = new Map<string, Stats>()

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
            if (ns.exec(this.action, server.static.name, scheduledThreads, this.target, scheduledThreads.toString(), initialDelay.toString(), (new Date()).getTime().toString()) == 0) {
                continue
            }
            info(ns, JSON.stringify(new ActionMessage(this.action, this.target, scheduledThreads, Status.Processing, operationTime), null, 2))
        }
        getTotalAvailableRam(ns, servers)
        return this.threads
    }
}

const getDelay = function (initialWeakenTime: number, operationTime: number, operationDelay: number): number {
    if (initialWeakenTime * 1000 > (operationTime * 1000 + operationDelay)) {
        return initialWeakenTime * 1000 - operationTime * 1000 - operationDelay
    }
    return operationDelay
}

const initialize = async function (ns: NS, target: Server, stats: Stats) {
    const host = target.static.name

    const totalWeakensNeeded = getWeakensToZero(ns, target)
    let totalGrowsNeeded = getGrowthsToMax(ns, target)

    //Initial Weaken Period
    let initiaWeakenTime = 0
    if (totalWeakensNeeded > 0) {
        initiaWeakenTime = target.dynamic.weakenTime
        await dispatch(ns,
            Action.Weaken,
            host,
            totalWeakensNeeded,
            initiaWeakenTime,
            0)
    }

    let growDelay = getDelay(initiaWeakenTime, stats.minGrowTime, stats.growDelay)
    let weakenDelay = getDelay(initiaWeakenTime, stats.minWeakenTime, stats.weakenDelay)

    let availableRam = getTotalAvailableRam(ns, new Array())
    let availableThreads = availableRam / ns.getScriptRam(Action.Grow)

    //Initial Growth Period
    if (totalGrowsNeeded > 0) {
        let grows = (totalGrowsNeeded > maxGrowBatchSize) ? maxGrowBatchSize : totalGrowsNeeded
        let growThreads = Math.floor(availableThreads / (maxGrowBatchSize + maxGrowBatchSize*weakensPerGrow)) == 0 ? Math.floor(availableThreads - (availableThreads*weakensPerGrow)) : grows
        for (; totalGrowsNeeded > 0; totalGrowsNeeded -= growThreads) {

            await dispatch(ns,
                Action.Grow,
                host,
                growThreads,
                stats.minGrowTime,
                growDelay + jobSegmentSpacing)
            await dispatch(ns,
                Action.Weaken,
                host,
                growThreads*weakensPerGrow,
                stats.minWeakenTime,
                weakenDelay + jobSegmentSpacing)
        }
    }

    if (totalWeakensNeeded > 0 || totalGrowsNeeded > 0) {
        stats.initializationTime = (target.dynamic.weakenTime * 1000 + weakenDelay) > (target.dynamic.growTime * 1000 + growDelay + jobSegmentSpacing) ?
            target.dynamic.weakenTime * 1000 + weakenDelay :
            target.dynamic.growTime * 1000 + growDelay + jobSegmentSpacing
    }
}

const reap = async function (ns: NS, target: Server) {
    if (!targets.has(target.static.name)) {
        targets.set(target.static.name, new Stats((new Date().getTime())))
    }
    const host = target.static.name
    const stats = targets.get(host).update(ns, target)

    if (stats.initializationTime <= 0 ||
        (
            (target.dynamic.currentMoney < target.static.maxMoney * (desiredMoneyRatio - 0.1))
            &&
            stats.getInitializationTimeRemaining() < 0
        )) {
        stats.origin = new Date().getTime()
        await initialize(ns, target, stats)
    }

    let hackDelay = stats.getInitializationDelay(stats.hackDelay, stats.minHackTime)
    let growDelay = stats.getInitializationDelay(stats.growDelay, stats.minGrowTime)
    let weakenDelay = stats.getInitializationDelay(stats.weakenDelay, stats.minWeakenTime)

    let availableRam = getTotalAvailableRam(ns, new Array())
    let availableThreads = availableRam / ns.getScriptRam(Action.Grow)

    // Schedule Hacks  
    let hacks = stats.hackThreads

    if (hacks <= 0) {
        hacks = ns.hackAnalyzeThreads(host, target.static.maxMoney * 0.1)
        if (hacks <= 0) {
            return
        }
    }

    let weakenBatch = Math.ceil(hacks * weakensPerHack)
    let hackThreads = Math.floor(availableThreads / (hacks + weakenBatch)) == 0 ? Math.floor(availableThreads - (availableThreads*weakensPerHack)) : hacks
    for (; hacks > 0; hacks -= hackThreads) {

        await dispatch(ns,
            Action.Grow,
            host,
            hackThreads,
            stats.minGrowTime,
            hackDelay + jobSegmentSpacing)
        await dispatch(ns,
            Action.Weaken,
            host,
            hackThreads*weakensPerHack,
            stats.minWeakenTime,
            weakenDelay + jobSegmentSpacing)
    }
    //Schedule Grows


    let grows = stats.growThreads

    if (grows <= 0) {
        grows = ns.growthAnalyze(target.static.name, target.static.maxMoney * 0.1)
    }
    weakenBatch = Math.ceil(grows * weakensPerGrow)
    let growThreads = Math.floor(availableThreads / (maxGrowBatchSize + weakenBatch)) == 0 ? Math.floor(availableThreads - (availableThreads*weakensPerGrow)) : grows
    for (; grows > 0; grows -= growThreads) {
    await dispatch(ns,
        Action.Grow,
        host,
        growThreads,
        stats.minGrowTime,
        growDelay + (jobSegmentSpacing * 2))


    await dispatch(ns,
        Action.Weaken,
        host,
        growThreads*weakensPerGrow,
        stats.minWeakenTime,
        weakenDelay + (jobSegmentSpacing * 2))
    }
}

export const dispatch = async function (ns: NS, action: Action, hostname: string, batchSize: number, operationTime: number, delay: number) {
    const dispatchAction = new DispatchAction(hostname, batchSize, action)
    while (await dispatchAction.dispatch(ns, operationTime, delay)) {
        await (ns.sleep(500))
    }
}

export const main = async function (ns: NS) {
    ns.disableLog("ALL")

    while (true) {
        let targets = getSortedTargetServers(ns, getHackableServers(ns, new Array()))
        if (targets.length == 0) {
            warn(ns, "no available targets", "")
            await ns.sleep(schedulingInterval)
            continue
        }
        await reap(ns, targets[0])
        await ns.sleep(schedulingInterval)
    }
}

