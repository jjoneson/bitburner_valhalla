import type {BitBurner as NS} from "Bitburner"
export const main = async function(ns: NS) {
    let target = ns.args[0]
    let threadCount = ns.args[1]
    let wait = ns.args[2]
    await ns.sleep(wait)
    await ns.grow(target, {threads: threadCount})
}