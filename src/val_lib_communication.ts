import { Action, Status } from "./val_lib_enum";

export class ActionMessage {
    action: Action
    target: string
    threads: number
    status: Status

    constructor(action: Action, target: string, threads: number, status: Status) {
        this.action = action
        this.target = target
        this.threads = threads
        this.status = status
    }
}

export class ScheduleMessage {
    target: string

    constructor(target: string) {
        this.target = target
    }
}