import type {BitBurner as NS} from "Bitburner"
export const main = async function(ns: NS) {
    let target = ns.args[0]
    let threadCount = ns.args[1]

    await ns.hack(target, {threads: threadCount})
}