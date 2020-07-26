export enum Action {
    Hack = "val_hack.js",
    Grow = "val_grow.js",
    Weaken = "val_weaken.js"
}

export enum Ports {
    Actions = 1,
    Scheduling = 2,
    Dispatching = 3
}

export enum PortInfo {
    Empty = "NULL PORT DATA"
}

export enum Status {
    Processing,    
    Complete,
    Failed,
}