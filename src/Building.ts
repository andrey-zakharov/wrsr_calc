type ResourceAmount = Record<string, number>

type BuildingData = {
    name: number,
    consumption: ResourceAmount,
    consumption_per_second: ResourceAmount,
    production: ResourceAmount,
    workers_needed: number,
}
export class Building {
    constructor(
        public id: string,
        public data: BuildingData
    ) {
        if ( data.consumption?.eletric ) {
            delete data.consumption.eletric
        }
        //data.consumption = { ...data.consumption, ...data.consumption_per_second }
    }

    public get maxOutput() {
        return objectMap( this.data.production, v => v * this.data.workers_needed )
    }

    public get maxInput() {
        return objectMap( this.data.production, v => v * this.data.workers_needed )
    }

    public get imgName() {
        return this.id + ".png"
    }
}

export function objectMap(object, mapFn) {
    return Object.keys(object).reduce(function(result, key) {
        result[key] = mapFn(object[key])
        return result
    }, {})
}
