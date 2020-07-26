import type { BitBurner as NS } from "Bitburner"

export const execSingleInstance = function (ns: NS, script: string, target: string,  kill?: boolean, threads?: 1, args?: string) {
    const running = ns.scriptRunning(script, target)
    if( running && kill) {
        ns.scriptKill(script, target)
    } else if(running && !kill) {
        return
    }
    ns.exec(script, target, threads, args)
}
