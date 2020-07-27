import type {BitBurner as NS} from "Bitburner"
import { homeServer, crackingScript, schedulerScript, ramScript, schedulingInterval } from "./val_lib_constants.js"
import { getRootedServers } from "./val_lib_servers.js"

export const main = async function(ns: NS) {
    // Kill any existing instances of scripts
    const servers = getRootedServers(ns, new Array())
    let crackKilled = false
    let schedulerKilled = false
    let ramKilled = false
    for (const server of servers) {
        crackKilled = crackKilled ? crackKilled : ns.scriptKill(crackingScript, server.static.name)
        schedulerKilled = schedulerKilled ? schedulerKilled : ns.scriptKill(schedulerScript, server.static.name)
        ramKilled = ramKilled ? ramKilled : ns.scriptKill(ramScript, server.static.name)
        if (crackKilled && schedulerKilled && ramKilled) break
    }
    
    const crackRam = ns.getScriptRam(crackingScript)
    const schedulerRam = ns.getScriptRam(schedulerScript)
    const ramRam = ns.getScriptRam(ramScript)
    const totalRamRequired = crackRam + schedulerRam + ramRam

    // start cracking to get more ram
    ns.exec(crackingScript, homeServer, 1)
    await ns.sleep(1000)
    ns.scriptKill(crackingScript, homeServer)

    // run scripts
    let crackRunning = false
    let ramRunning = false
    for (const server of getRootedServers(ns, new Array())) {
        if (server.static.name == homeServer) continue
        if (!crackRunning && server.dynamic.availableRam > crackRam) {
            ns.exec(crackingScript, server.static.name, 1)
            crackRunning = true
            server.updateDynamicProps(ns)
        }
        if (!ramRunning && server.dynamic.availableRam > ramRam) {
            ns.exec(ramScript, server.static.name, 1)
            ramRunning = true
            server.updateDynamicProps(ns)
        }
        if (ramRunning && crackRunning) break
    }

    ns.spawn(schedulerScript, 1)
}