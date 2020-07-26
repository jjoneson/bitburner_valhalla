import type {BitBurner as NS} from "Bitburner"

export const warn = function(ns: NS, message: string, stack: string, terminal?: boolean) {
    message = `${message}: ${stack}`
    log(ns, message, "WARNING: ", terminal)
}

export const info = function(ns: NS, message: string, terminal?: boolean) {
    log(ns, message, "INFO: ", terminal)
}

export const log = function(ns: NS, message: string, prefix?: string, terminal?: boolean) {
    const timestamp = '['+new Date().toISOString()+']'
    const output = `${timestamp} ${prefix}${message}`
    terminal ? ns.tprint(output) : ns.print(output)
}