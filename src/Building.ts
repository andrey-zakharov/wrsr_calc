type ResourceAmount = Record<string, number>

type BuildingData = {
    name: number,
    consumption: ResourceAmount,
    consumption_per_second: ResourceAmount,
    production: ResourceAmount,
    workers_needed: number,
    professors_needed: number,
}
export class Building {
    constructor(
        public id: string,
        public data: BuildingData
    ) {
        if ( data.consumption?.eletric ) {
            delete data.consumption.eletric
        }
        // containers hack, TBD string condition
        if ( data.consumption?.vehicles > 0 && Object.keys( data.consumption ).length > 1 ) {
            // container detected
            delete data.consumption.vehicles
        }
        if ( data.production?.vehicles > 0 && Object.keys( data.production ).length > 1 ) {
            // container detected
            delete data.production.vehicles
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
