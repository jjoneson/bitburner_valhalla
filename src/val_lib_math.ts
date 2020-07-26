export const getCurrentSeconds = function(): number {
    return Math.round((new Date()).getTime()/1000)
}

export const getExpectedFinishTime = function(seconds: number): number {
    return getCurrentSeconds() + seconds
}