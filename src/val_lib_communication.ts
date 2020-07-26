import { Action, Status } from "./val_lib_enum.js";

export class ActionMessage {
    action: Action
    target: string
    threads: number
    status: Status
    executionSeconds: number

    constructor(action: Action, target: string, threads: number, status: Status, executionSeconds: number) {
        this.action = action
        this.target = target
        this.threads = threads
        this.status = status
        this.executionSeconds = executionSeconds
    }
}

export class ScheduleMessage {
    target: string

    constructor(target: string) {
        this.target = target
    }
}