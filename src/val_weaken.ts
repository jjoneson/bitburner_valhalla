import type {BitBurner as NS} from "Bitburner"
export const main = async function(ns: NS, args: any[]) {
    let target = args[0]
    let threadCount = args[1]

    ns.weaken(target, {threads: threadCount})
}