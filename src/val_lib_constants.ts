export interface Program {
    name: string
    cost: number
}

export const crackingPrograms: Program[] = [
    {name: "BruteSSH.exe", cost: 500000},
    {name: "FTPCrack.exe", cost: 1500000},
    {name: "relaySMTP.exe", cost: 5000000},
    {name: "HTTPWorm.exe", cost: 30000000},
    {name: "SQLInject.exe", cost: 250000000},
]

export const utilityPrograms: Program[] = [
    {name: "DeepscanV1.exe", cost: 500000},
    {name: "AutoLink.exe", cost: 1000000},
    {name: "ServerProfiler.exe", cost: 1000000},
    {name: "DeepscanV2.exe", cost: 1000000}
]
export const scriptExtensions: string[] = [
    ".ns",
    ".script",
    ".js"
]
export const homeServer: string = "home"
export const stockTradeComission: number = 100000
export const initScript: string = `val_init.js`
export const crackingScript: string = `val_crack.js`
export const listenerScript: string = `val_listener.js`
export const schedulerScript: string = `val_scheduler.js`
export const copyScript: string = `val_cp.js`
export const killScript: string = `val_kill.js`
export const ramScript: string = `val_ram.js`
export const startupScripts: string[] = [
    crackingScript,
    schedulerScript
]
export const minimumCashReserves: number = 300000000
export const serverNamePrefix: string = "serv-"
export const schedulingInterval: number = 12000
export const ramCost: number = 55000
export const weakenAmount: number = 0.05
export const hackAmount: number = 0.002
export const growAmount: number = 0.004
export const hacksPerWeaken: number = Math.ceil(hackAmount/weakenAmount)
export const growsPerWeaken: number = Math.ceil(growAmount/weakenAmount)
export const desiredMoneyRatio: number = 0.9

